/********************************server.js***********************
 * Express server that provides API access to a map
 *  and also acts as a proxy to the Bedrock API:
 * Exposes an endpoint /api/chat that accepts POST requests with a user message
 * and optional system prompt, forwards them to Bedrock, and returns the response.
 *
 * Requires the following environment variables:
 * - BEDROCK_API_KEY: Your Bedrock API key
 * - AWS_REGION: AWS region where Bedrock is hosted (default: eu-west-2)
 * - MODEL_ID: Bedrock model ID to use (default: eu.anthropic.claude-haiku-4-5-20251001-v1:0)
 * These are obtained from the AWS Secrets Manager
 *
 * Run this as a service: prsm-api-server.service:
 *
 * /etc/systemd/system/prsm-api-server.service
 *
 * for status, use:
 * journalctl -f -u prsm-api-server
 ****************************************************************
 *
 * or locally:
 * npm run local
 ***************************************************************/

import express from 'express'
import cors from 'cors'
import {WebsocketProvider} from 'y-websocket'
import * as Y from 'yjs'
import {createHttpTerminator} from 'http-terminator'
import {BedrockAgentRuntimeClient, RetrieveCommand} from '@aws-sdk/client-bedrock-agent-runtime'
import {ClassicLevel} from 'classic-level'
import rateLimit from 'express-rate-limit'
import {loadSecrets} from './secrets.mjs'

process.title = 'api-server'

// use local websocket server if in development mode
let websocket = 'wss://www.prsm.uk/wss'

const helpCacheLocation = process.env.HELP_CACHE_LOCATION || './helpCache'
const cacheResults = process.env.DONT_CACHE_HELP !== 'true'

if (process.env.NODE_ENV === 'dev') {
	console.log('Running in development mode')
	websocket = 'ws://localhost:1234'
}
/**
 * Map env/service labels to Bedrock tier values.
 * @param {string} tier
 * @returns {string}
 */
function normaliseServiceTier(tier) {
	if (!tier) return 'default'
	const lowerTier = tier.toLowerCase()
	if (lowerTier === 'standard') return 'default'
	if (lowerTier === 'default' || lowerTier === 'flex' || lowerTier === 'priority' || lowerTier === 'reserved') {
		return lowerTier
	}
	return 'default'
}
const qualityModelId = process.env.MODEL_ID || 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'
const cheapModelId = 'qwen.qwen3-235b-a22b-2507-v1:0'
const CHAT_SERVICE_TIER = process.env.CHAT_SERVICE_TIER || 'standard'
const HELP_SERVICE_TIER = process.env.HELP_SERVICE_TIER || 'standard'
const REPHRASE_SERVICE_TIER = process.env.REPHRASE_SERVICE_TIER || 'flex'
const HELP_STRUCTURED_OUTPUT_ENABLED = process.env.HELP_STRUCTURED_OUTPUT !== 'false'
const agentClient = new BedrockAgentRuntimeClient({
	region: process.env.AWS_REGION || 'eu-west-2',
})

// cache for help assistant answers, to avoid repeated calls to Bedrock for the same question
const helpCache = new ClassicLevel(helpCacheLocation, {valueEncoding: 'json'})

const app = express()
const PORT = process.env.PORT || 3001

// Rate limiting and concurrency control
const globalLimiter = rateLimit({
	windowMs: 1000, // 1 second
	limit: 20, // 20 requests per second per IP
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		error: 'Too many requests per second (>20), please slow down and try again.',
	},
})

const chatLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	limit: 5, // 5 chat requests per minute per IP
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		error: 'Too many chat requests, please slow down and try again shortly.',
	},
})
app.set('trust proxy', 1) // trust first proxy, if behind a proxy
let inFlightChatRequests = 0
const MAX_IN_FLIGHT_CHAT = 10

// Middleware
app.use(cors({origin: ['https://prsm.uk', 'http://localhost', 'http://127.0.0.1']}))
app.use(express.json())
app.use(globalLimiter)

// Check that all incoming requests have a valid room id., and note it for use in the handlers

app.all(
	[
		'/api/chat/:room',
		'/api/map/:room',
		'/api/map/:room/allFactorsAndLinks',
		'/api/map/:room/factor/:factor',
		'/api/map/:room/link/:link',
		'/api/map/:room/styles',
		'/api/map/:room/styles/:style',
	],
	(req, res, next) => {
		try {
			checkRoom(req.params.room)
			next()
		} catch (error) {
			res.status(400).json({error: error.message})
		}
	},
)
// Proxy endpoint for Bedrock chat
app.post('/api/chat/:room', chatLimiter, async (req, res) => {
	// Bedrock configuration from environment variables
	const region = process.env.AWS_REGION || 'eu-west-2'
	const bedrockApiKey = process.env.BEDROCK_API_KEY
	logAPICalls(`Using chat for room ${req.params.room}`)

	if (!bedrockApiKey) {
		console.error('ERROR: BEDROCK_API_KEY environment variable is not set')
		return res.status(500).json({error: 'LLM API key is not set'})
	}

	if (inFlightChatRequests >= MAX_IN_FLIGHT_CHAT) {
		return res.status(503).json({error: 'Server is busy, please retry later.'})
	}

	inFlightChatRequests += 1
	try {
		const { message, systemPrompt } = req.body
		if (!message) {
			return res.status(400).json({error: 'Message is required'})
		}
		// reject excessively long prompts
		const maxPromptLength = parseInt(process.env.MAX_PROMPT_LENGTH) || 30000
		if (message.length + (systemPrompt?.length || 0) > maxPromptLength) {
			return res.status(400).json(`Message is too long. Please limit to ${maxPromptLength} characters.`)
		}
		const conversation = [
			{
				role: 'user',
				content: [{text: message}],
			},
		]
		const chatSystemPrompt = `${systemPrompt ? `${systemPrompt}\n\n` : ''}> ***This text has been generated by AI. It needs to be checked carefully.***\nFormat your answer using Markdown.`
		const payload = withServiceTier({
			modelId: qualityModelId,
			messages: conversation,
			system: [
				{
					text: chatSystemPrompt,
				},
			],
			inferenceConfig: {maxTokens: parseInt(process.env.MAX_TOKENS) || 512, temperature: 0.5},
		}, CHAT_SERVICE_TIER)
	
		const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${qualityModelId}/converse`
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${bedrockApiKey}`,
			},
			body: JSON.stringify(payload),
		})

		if (!response.ok) {
			const errorText = await response.text()
			console.error('Bedrock API error:', errorText)
			return res.status(response.status).json({error: errorText})
		}

		const data = await response.json()
		if (data.usage) {
			logAPICalls(
				`Token usage - input: ${data.usage.inputTokens}, output: ${data.usage.outputTokens}, total: ${data.usage.totalTokens}`,
			)
		}
		const responseText = data.output.message.content[0].text

		res.json({response: responseText})
	} catch (error) {
		console.error('Server error:', error)
		res.status(500).json({error: error.message})
	} finally {
		inFlightChatRequests -= 1
	}
})

/**
 * Help Assistant Endpoint
 * Uses RAG to answer questions based on the PRSM manual
 */
app.post('/api/helpAssistant', chatLimiter, async (req, res) => {
	const {messages} = req.body
	const region = process.env.AWS_REGION || 'eu-west-2'
	const bedrockApiKey = process.env.BEDROCK_API_KEY
	const kbId = process.env.KNOWLEDGE_BASE_ID || '48IIKVEPJC'

	if (!bedrockApiKey) {
		console.error('ERROR: BEDROCK_API_KEY environment variable is not set')
		return res.status(500).json({error: 'LLM API key is not set'})
	}

	try {
		const lastUserMessage = messages[messages.length - 1].content[0].text

		// STEP -1: Check cache first
		try {
			const cachedResponse = await helpCache.get(lastUserMessage)
			if (cachedResponse) {
				logAPICalls(`Help Assistant cache hit for message: ${lastUserMessage}`)
				return res.json(cachedResponse)
			} else {
				logAPICalls(`Help Assistant cache miss for message: ${lastUserMessage}.`)
			}
		} catch (err) {
			// Cache miss or error, proceed without failing
			logAPICalls(`Help Assistant cache error for message: ${lastUserMessage}. Error: ${err.message}`)
		}

		// STEP 0: If it's a follow-up, rephrase it for the Knowledge Base search
		let standaloneQuery = lastUserMessage
		if (messages.length > 1) {
			const rephrasePayload = withServiceTier({
				modelId: cheapModelId, // Use Qwen here to save money,
				messages: [
					...messages.slice(0, -1),
					{
						role: 'user',
						content: [
							{
								text: `Based on the conversation above, write a specific search query to find information for the user's last request: "${lastUserMessage}". Return ONLY the search query text, no other text.`,
							},
						],
					},
				],
				inferenceConfig: {maxTokens: 50, temperature: 0},
			}, REPHRASE_SERVICE_TIER)

			const rephraseRes = await fetch(
				`https://bedrock-runtime.${region}.amazonaws.com/model/${cheapModelId}/converse`,
				{
					method: 'POST',
					headers: {'Content-Type': 'application/json', Authorization: `Bearer ${bedrockApiKey}`},
					body: JSON.stringify(rephrasePayload),
				},
			)
			if (rephraseRes.ok) {
				const rephraseData = await rephraseRes.json()
				standaloneQuery = extractConverseText(rephraseData) || standaloneQuery
			} else {
				const rephraseErrorText = await rephraseRes.text()
				logAPICalls(
					`Rephrase call failed (${rephraseRes.status}); falling back to last user message. ${rephraseErrorText}`,
				)
			}
		}

		if (!standaloneQuery) return res.status(400).json({error: 'Message is required'})

		// STEP 1: Retrieve context from the Knowledge Base
		const retrieveCommand = new RetrieveCommand({
			knowledgeBaseId: kbId,
			retrievalQuery: {text: standaloneQuery},
			retrievalConfiguration: {
				vectorSearchConfiguration: {numberOfResults: 5},
			},
		})

		const retrieveResponse = await agentClient.send(retrieveCommand)
		const retrievalResults = retrieveResponse.retrievalResults
		const context = retrievalResults
			.map((r, index) => {
				const meta = r.content?.metadata || r.metadata || {}
				const s3Uri = r.location?.s3Location?.uri || ''
				const isManual = meta.doc_type === 'manual' || s3Uri.toLowerCase().endsWith('.md')
				const label = isManual ? 'SOURCE: PRSM USER MANUAL' : 'SOURCE: RESEARCH MATERIAL'
				return `[Source Index: ${index}] --- ${label} ---\n${r.content.text}\n`
			})
			.join('\n\n')

		// console.log(`\nChunks retrieved from KB:\n${context}`)

		// STEP 2: Generate answer using the high quality model, with the retrieved context as part of the system prompt
		const systemPrompt = `You are the PRSM Help Assistant, a technical expert for the PRSM Participatory System Mapping web application.

Your primary goal is to provide instructions based on the standard user interface and general features. You are also able to provide general guidance aboout how to conduct Participatory System Mapping.

### INTENT-BASED FILTERING (CRITICAL)
Before answering, determine the user's intent:

1. **PRACTICAL "HOW-TO" QUERIES:** (e.g., "How do I...", "Where is the button for...", "Steps to...")
   - **RULE:** You must EXCLUSIVELY use information labeled '[SOURCE: PRSM USER MANUAL]'. 
   - **ACTION:** Ignore all chunks labeled '[SOURCE: RESEARCH MATERIAL]'. Do not include definitions, theories, or academic background. Just give the steps.

2. **CONCEPTUAL/THEORETICAL QUERIES:** (e.g., "What is a link?", "Why use mapping?", "Explain the theory of...")
   - **RULE:** Use both 'MANUAL' and 'CONCEPTUAL' sources.
   - **ACTION:** Provide the theoretical definition from the research material, but follow it up by explaining how that specific concept is implemented or represented within the PRSM application using the manual.

### CONSTRAINTS
- **API EXCLUSION:** You are STRICTLY FORBIDDEN from mentioning or referencing the "PRSM API" or technical API endpoints unless the user specifically asks a question containing the word "API". 
- **SOURCE TRUTH:** Use only the provided Context. If the information is missing, state clearly that you do not know.
- **USER FOCUS:** Always prioritize providing instructions that a user can follow through the UI, even if you know there are API endpoints that could also achieve the same result. The user is not a developer and does not have access to the API.
- **PRIORITIZE MANUAL:** Always prioritize information from the PRSM manual, as this is the official source of truth for how to use the application. If other sources offer conflicting information, always default to the manual's guidance.

### RESPONSE GUIDELINES
1. **Focus:** Prioritize UI-based workflows and manual instructions.
2. For practical queries, strictly provide a numbered list of steps and nothing else.
3. **No question restatement:** Do NOT start with a title, heading, or paraphrase of the user's question (e.g. do not answer "How do I create a link?" with "# How to Create a Link"). Begin directly with the answer or first step. Use Markdown headers only for distinct subsections later in longer answers, never as an opening restatement.
4. **Formatting:** Always use clean Markdown. Prefer lists and short paragraphs over decorative titles.
5. **Examples:** Provide code snippets only when they illustrate configuration or non-API technical setups described in the manual.
6. **Clarity:** Ensure instructions are clear and actionable for users of all technical levels.
7. **Continuations:** Offer to provide more detail or cover additional topics if the user is interested.
8. **Citations:** Record the numeric indices of the sources you actually extracted information from. If you ignored a source because it was the wrong doc_type, do NOT include its index. Never print bare index lists such as [0, 1, 2] in the answer body.
9. **Output:** Put the user-facing answer in Markdown only. Do not include a Sources section or source index numbers in the answer text; citations are collected separately by the response format.

### MANUAL CONTEXT
<context>${context}</context>`

		const finalPayload = withServiceTier({
			modelId: qualityModelId, // Use Haiku 4.5 for the final response
			messages,
			system: [
				{
					text: systemPrompt,
				},
			],
			inferenceConfig: {
				maxTokens: parseInt(process.env.MAX_TOKENS) || 2048,
				temperature: 0.2, // Lower temperature for factual help
			},
			...(HELP_STRUCTURED_OUTPUT_ENABLED
				? {
						outputConfig: {
							textFormat: {
								type: 'json_schema',
								structure: {
									jsonSchema: {
										name: 'prsm_help_response',
										description: 'Structured response for PRSM help assistant with cited source indices.',
										schema: JSON.stringify({
											type: 'object',
											properties: {
												answer_markdown: {type: 'string'},
												used_source_indexes: {
													type: 'array',
													items: {type: 'integer'},
												},
											},
											required: ['answer_markdown', 'used_source_indexes'],
											additionalProperties: false,
										}),
									},
								},
							},
						},
					}
				: {}),
		}, HELP_SERVICE_TIER)

		const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${qualityModelId}/converse`
		let finalResponse = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${bedrockApiKey}`,
			},
			body: JSON.stringify(finalPayload),
		})
		if (!finalResponse.ok && HELP_STRUCTURED_OUTPUT_ENABLED) {
			const retryPayload = withServiceTier({
				modelId: qualityModelId,
				messages,
				system: [{text: systemPrompt}],
				inferenceConfig: {
					maxTokens: parseInt(process.env.MAX_TOKENS) || 2048,
					temperature: 0.2,
				},
			}, HELP_SERVICE_TIER)
			finalResponse = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${bedrockApiKey}`,
				},
				body: JSON.stringify(retryPayload),
			})
		}
		if (!finalResponse.ok) {
			const errorText = await finalResponse.text()
			console.error('Bedrock API error:', errorText)
			return res.status(finalResponse.status).json({error: errorText})
		}
		const finalData = await finalResponse.json()

		if (finalData.usage) {
			logAPICalls(
				`Token usage - input: ${finalData.usage.inputTokens}, output: ${finalData.usage.outputTokens}, total: ${finalData.usage.totalTokens}`,
			)
		}
		const fullAiResponse = extractConverseText(finalData)
		// console.log(`Full AI response:\n${fullAiResponse}\nEnd of response.`)
		const {responseText, usedIndices} = parseHelpAssistantResponse(fullAiResponse)
		if (!responseText) {
			return res.status(502).json({error: 'Model response was empty'})
		}

		// 3. Map only the USED sources
		const sources = usedIndices
			.map((index) => {
				const result = retrievalResults[index]
				if (!result) return null

				const metadata = result.content?.metadata || result.metadata || {}
				return {
					name: metadata.display_name || metadata['x-amz-bedrock-kb-source-uri'] || 'Manual Source',
					url: metadata.url || result.location?.webLocation?.url || null,
				}
			})
			.filter(Boolean) // Remove any nulls
		// console.log(`Sources cited by the AI (after filtering): ${JSON.stringify(sources)}`)

		// 4. Deduplicate (in case the LLM cited two chunks from the same chapter)
		const uniqueSources = Array.from(new Map(sources.map((s) => [s.name, s])).values())

		// Cache the response for future requests. If the same question is asked again, we can return
		// the cached answer without calling Bedrock, which saves costs and reduces latency.  But do not
		// cache if it's a follow-up question, as the answer may depend on the previous conversation.
		if (cacheResults && messages.length === 1) {
			// i.e just one user message
			try {
				await helpCache.put(lastUserMessage, {
					response: responseText,
					sources: uniqueSources,
				})
				logAPICalls(`Cached response for message: ${lastUserMessage}`)
			} catch (err) {
				logAPICalls(`Failed to cache response for message: ${lastUserMessage}. Error: ${err.message}`)
			}
		}

		res.json({
			response: responseText,
			sources: uniqueSources,
		})
	} catch (error) {
		console.error('Help Assistant Error:', error)
		res.status(500).json({error: error.message})
	}
})

// Endpoints for API access to map data

// The properties of factors and links that should not be exposed through the API

const privateFactorProperties = [
	'bc',
	'borderWidthSelected',
	'clusteredIn',
	'fixed',
	'heightConstraint',
	'labelHighlightBold',
	'margin',
	'nodeHidden',
	'opacity',
	'scaling',
	'size',
	'val',
	'widthConstraint',
]

const privateLinkProperties = ['edgeHidden', 'hoverWidth', 'labelHighlightBold', 'selectionWidth', 'locked', 'opacity']

/**
 * GET basic info about the map: title, background color, attribute dictionary, list of factors and links
 * Map must exist (i.e. have been created using the web interface)
 */
app.get('/api/map/:room', async (req, res) => {
	try {
		logAPICalls(`Fetching map for room ${req.params.room}`)
		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yNodesMap = doc.getMap('nodes')
			const yEdgesMap = doc.getMap('edges')
			const yNetMap = doc.getMap('network')
			checkMapExists(yNetMap)
			res.json({
				room: req.params.room,
				title: yNetMap.get('mapTitle'),
				viewOnly: yNetMap.get('viewOnly'),
				version: yNetMap.get('version'),
				background: yNetMap.get('background'),
				attributeTitles: yNetMap.get('attributeTitles') || {},
				nodes: Array.from(yNodesMap.values(), (n => ({ id: n.id, label: n.label, x: n.x, y: n.y }))),
				edges: Array.from(yEdgesMap.values(), (e => ({ id: e.id, from: e.from, to: e.to, label: e.label }))),
			})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

/**
 * UPDATE basic map info (title and background color)
 */
app.patch('/api/map/:room', async (req, res) => {
	try {
		logAPICalls(`Updating map for room ${req.params.room}`)
		const {update} = req.body

		if (!update) {
			return res.status(400).json({error: 'Nothing provided for update'})
		}
		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yNetMap = doc.getMap('network')
			checkMapExists(yNetMap)
			if (update.title) {
				yNetMap.set('mapTitle', update.title)
			}
			if (update.background) {
				yNetMap.set('background', update.background)
			}
			res.json({
				room: req.params.room,
				title: yNetMap.get('mapTitle'),
				background: yNetMap.get('background'),
			})
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

/**
 * Return full details about all factors and links
 */
app.get('/api/map/:room/allFactorsAndLinks', async (req, res) => {
	try {
		logAPICalls(`Fetching all factors and links for room ${req.params.room}`)
		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yNodesMap = doc.getMap('nodes')
			console.log(`Fetched ${yNodesMap.size} factors for room ${req.params.room}`)
			const yEdgesMap = doc.getMap('edges')
			const factors = stripArray(Array.from(yNodesMap.values()), privateFactorProperties)
			const links = stripArray(Array.from(yEdgesMap.values()), privateLinkProperties)
			console.log(`Fetched ${factors.length} factors and ${links.length} links for room ${req.params.room}`)
			res.json({factors, links})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

/**
 * Return full details about a specific factor
 */
app.get('/api/map/:room/factor/:factor', async (req, res) => {
	try {
		logAPICalls(`Fetching factor ${req.params.factor} for room ${req.params.room}`)
		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yNodesMap = doc.getMap('nodes')
			const factorDetails = yNodesMap.get(req.params.factor)
			if (factorDetails) {
				res.json(strip(factorDetails, privateFactorProperties))
			} else {
				res.status(404).json({error: 'Factor not found'})
			}
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

/**
 * Update properties of a specific factor
 * Body must include an 'update' object with the properties to update
 */
app.patch('/api/map/:room/factor/:factor', async (req, res) => {
	try {
		logAPICalls(`Updating factor ${req.params.factor} for room ${req.params.room}`)
		const {update} = req.body

		if (!update) {
			return res.status(400).json({error: 'Nothing provided for update'})
		}

		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yNodesMap = doc.getMap('nodes')
			const oldFactor = yNodesMap.get(req.params.factor)
			if (oldFactor) {
				const newFactor = {...deepUpdate(oldFactor, update), modified: {time: Date.now(), user: 'API'}}
				yNodesMap.set(req.params.factor, newFactor)
				res.json(strip(newFactor, privateFactorProperties))
			} else {
				res.status(404).json({error: 'Factor not found'})
			}
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

/**
 * Create a new factor with specified properties
 * Body must include a 'spec' object with the factor properties
 */
app.post('/api/map/:room/factor/:factor', async (req, res) => {
	try {
		logAPICalls(`Creating factor ${req.params.factor} for room ${req.params.room}`)
		const {spec} = req.body

		// validate spec: must have at least a label
		if (!spec) {
			return res.status(400).json({error: 'Missing factor specification'})
		}
		if (!spec.label) {
			return res.status(400).json({error: 'Missing factor label in spec.'})
		}
		const newFactor = {
			// default properties, which may be overwritten by spec.
			x: 0,
			y: 0,
			borderWidth: 0,
			borderWidthSelected: 4,
			color: {
				border: 'rgb(154, 219, 180)',

				background: 'rgb(154, 219, 180)',
				highlight: {
					border: 'rgb(154, 219, 180)',
					background: 'rgb(154, 219, 180)',
				},
				hover: {
					border: 'rgb(154, 219, 180)',
					background: 'rgb(154, 219, 180)',
				},
			},
			fixed: false,
			font: {
				face: 'Oxygen',
				color: 'rgb(0, 0, 0)',
				size: 14,
			},
			groupLabel: 'Sample',
			grp: 0,
			heightConstraint: false,
			labelHighlightBold: true,
			margin: 20,
			nodeHidden: false,
			opacity: 1,
			scaling: {
				label: {enabled: false, min: 10, max: 40},
				max: 40,
				min: 10,
			},
			shape: 'box',
			shapeProperties: {borderDashes: false},
			size: 25,
			widthConstraint: false,
			...spec,
			created: {time: Date.now(), user: 'API'},
			modified: {time: Date.now(), user: 'API'},
			id: req.params.factor,
		}

		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yNodesMap = doc.getMap('nodes')
			yNodesMap.set(req.params.factor, newFactor)
			res.json(strip(newFactor, privateFactorProperties))
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

/**
 * Delete a specific factor and all links to it
 */
app.delete('/api/map/:room/factor/:factor', async (req, res) => {
	try {
		logAPICalls(`Deleting factor ${req.params.factor} for room ${req.params.room}`)
		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yNodesMap = doc.getMap('nodes')
			const oldFactor = yNodesMap.get(req.params.factor)
			if (oldFactor) {
				// delete all links to this factor
				for (const [edgeId, edge] of doc.getMap('edges')) {
					if (edge.from === req.params.factor || edge.to === req.params.factor) {
						doc.getMap('edges').delete(edgeId)
					}
				}
				// then delete the factor
				yNodesMap.delete(req.params.factor)
				res.json({message: 'Factor deleted'})
			} else {
				res.status(404).json({error: 'Factor not found'})
			}
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

/**
 * Return full details about a specific link
 */
app.get('/api/map/:room/link/:link', async (req, res) => {
	try {
		logAPICalls(`Fetching link ${req.params.link} for room ${req.params.room}`)
		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yEdgesMap = doc.getMap('edges')
			const linkDetails = yEdgesMap.get(req.params.link)
			if (linkDetails) {
				res.json(strip(linkDetails, privateLinkProperties))
			} else {
				res.status(404).json({error: 'Link not found'})
			}
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

/**
 * Update properties of a specific link
 * Body must include an 'update' object with the properties to update
 */
app.patch('/api/map/:room/link/:link', async (req, res) => {
	try {
		logAPICalls(`Updating link ${req.params.link} for room ${req.params.room}`)
		const {update} = req.body

		if (!update) {
			return res.status(400).json({error: 'Nothing provided for update'})
		}

		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yEdgesMap = doc.getMap('edges')
			const oldLink = yEdgesMap.get(req.params.link)
			if (oldLink) {
				const newLink = {...deepUpdate(oldLink, update), modified: {time: Date.now(), user: 'API'}}
				yEdgesMap.set(req.params.link, newLink)
				res.json(strip(newLink, privateLinkProperties))
			} else {
				res.status(404).json({error: 'Link not found'})
			}
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

/**
 * Create a new link with specified properties
 * Body must include a 'spec' object with the link properties
 */
app.post('/api/map/:room/link/:link', async (req, res) => {
	try {
		logAPICalls(`Creating link ${req.params.link} for room ${req.params.room}`)
		const {spec} = req.body

		// validate spec: must have at least a from and to
		if (!spec) {
			return res.status(400).json({error: 'Missing link specification'})
		}
		if (!spec.from || !spec.to) {
			return res.status(400).json({error: 'Missing link endpoints in spec.'})
		}
		const newLink = {
			// default properties, which may be overwritten by spec.
			color: {
				color: 'rgb(0,0,0)',
				highlight: 'rgb(0,0,0)',
				hover: 'rgb(0,0,0)',
			},
			font: {
				face: 'Oxygen',
				color: 'rgb(0, 0, 0)',
				size: 14,
			},
			grp: 0,
			arrows: {
				to: {
					enabled: true,
					type: 'vee',
				},
				middle: {
					enabled: false,
				},
				from: {
					enabled: false,
				},
			},
			dashes: false,
			edgeHidden: false,
			groupLabel: 'Sample',
			hoverWidth: 1,
			labelHighlightBold: false,
			selectionWidth: 0,
			width: 1,
			...spec,
			created: {time: Date.now(), user: 'API'},
			modified: {time: Date.now(), user: 'API'},
			id: req.params.link,
		}

		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yNodesMap = doc.getMap('nodes')
			const edgesMap = doc.getMap('edges')
			// also ensure that the nodes exist
			if (!yNodesMap.has(newLink.from) || !yNodesMap.has(newLink.to)) {
				res.status(400).json({error: 'One or both link endpoints do not exist as factors.'})
			} else {
				edgesMap.set(req.params.link, newLink)
				res.json(strip(newLink, privateLinkProperties))
			}
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

/**
 * Delete a specific link
 */
app.delete('/api/map/:room/link/:link', async (req, res) => {
	try {
		logAPICalls(`Deleting link ${req.params.link} for room ${req.params.room}`)

		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yEdgesMap = doc.getMap('edges')
			const oldLink = yEdgesMap.get(req.params.link)
			if (oldLink) {
				yEdgesMap.delete(req.params.link)
				res.json({message: 'Link deleted'})
			} else {
				res.status(404).json({error: 'Link not found'})
			}
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})
/**
 *  Return a list of all styles (colors, fonts, shapes) used in the map, for factors and links.
 */
app.get('/api/map/:room/styles', async (req, res) => {
	try {
		logAPICalls(`Fetching styles for room ${req.params.room}`)
		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const ySamplesMap = doc.getMap('samples')
			const styles = Array.from(ySamplesMap.entries()).filter((style) => /^(edge|group)/.test(style[0]))
			res.json(styles)
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

/**
 *  Return the info for the given style.
 */
app.get('/api/map/:room/styles/:style', async (req, res) => {
	try {
		logAPICalls(`Fetching ${req.params.style} style for room ${req.params.room}`)
		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const ySamplesMap = doc.getMap('samples')
			const style = ySamplesMap.get(req.params.style)
			if (style) {
				if (style.node) {
					style.node = strip(style.node, privateFactorProperties)
				}
				if (style.edge) {
					style.edge = strip(style.edge, privateLinkProperties)
				}
				res.json([req.params.style, style])
			} else {
				res.status(404).json({error: 'Style not found'})
			}
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

app.patch('/api/map/:room/styles/:style', async (req, res) => {
	try {
		logAPICalls(`Updating style ${req.params.style} for room ${req.params.room}`)
		const {update} = req.body

		if (!update) {
			return res.status(400).json({error: 'Nothing provided for update'})
		}

		const {doc, wsProvider} = await withSyncedDoc(req.params.room)
		try {
			const yStylesMap = doc.getMap('samples')
			const oldStyle = yStylesMap.get(req.params.style)
			if (oldStyle) {
				const newStyle = deepUpdate(oldStyle, update)
				yStylesMap.set(req.params.style, newStyle)
				if (newStyle.node) {
					newStyle.node = strip(newStyle.node, privateFactorProperties)
				}
				if (newStyle.edge) {
					newStyle.edge = strip(newStyle.edge, privateLinkProperties)
				}
				res.json([req.params.style, newStyle])
			} else {
				res.status(404).json({error: 'Style not found'})
			}
		} catch (error) {
			res.status(500).json({error: error.message})
		} finally {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
		}
	} catch (error) {
		const status = error.message === 'WebSocket sync timed out' ? 504 : 500
		res.status(status).json({error: error.message})
	}
})

let server // server instance
let httpTerminator // terminator instance
/**
 * Start the server after loading secrets
 */
async function start() {
	// Load secrets first
	await loadSecrets()
	// Start the server
	server = app.listen(PORT, () => {
		console.log(
			`Proxy server running on http://localhost:${PORT} using websocket server at ${websocket}, 
			models ${qualityModelId} and ${cheapModelId} and 
			helpCache at ${helpCache.location}`,
		)
	})
	httpTerminator = createHttpTerminator({server})
}
start()

/****** Utilities  ************/

const WS_TIMEOUT_MS = 10000
/**
 * Return a promise that resolves with the Y.Doc and WebsocketProvider for a given room once the document is synced
 * Rejects if syncing takes longer than WS_TIMEOUT_MS
 * @param {string} room
 * @returns Promise that resolves with {doc, wsProvider}
 */
function withSyncedDoc(room) {
	return new Promise((resolve, reject) => {
		const doc = new Y.Doc()
		const wsProvider = new WebsocketProvider(websocket, `prsm${room}`, doc)
		const timer = setTimeout(() => {
			doc.destroy()
			wsProvider.disconnect()
			wsProvider.destroy()
			reject(new Error('WebSocket sync timed out'))
		}, WS_TIMEOUT_MS)
		wsProvider.on('synced', () => {
			clearTimeout(timer)
			resolve({doc, wsProvider})
		})
	})
}

// Graceful shutdown on Ctrl-C and systemctl stop
process.on('SIGINT', () => {
	console.log('\nReceived SIGINT, shutting down...')
	handleShutdown()
})
process.on('SIGTERM', () => {
	console.log('\nReceived SIGTERM, shutting down...')
	handleShutdown()
})
async function handleShutdown() {
	await httpTerminator.terminate()
	await helpCache.close()
	console.log('Help cache closed')
	console.log('HTTP server closed')
	process.exit(0)
}

/**
 * Check that a room identifier is properly formed
 * @param {string} room
 * @throws {Error} if room is invalid
 */
function checkRoom(room) {
	if (!room || !room.match(/^[A-Z]{3}-[A-Z]{3}-[A-Z]{3}-[A-Z]{3}$/)) {
		throw new Error(`Invalid room identifier: ${room}`)
	}
}
/**
 * Check that a map has been created using the web interface
 * Since there is no way to list existing Yjs documents on the server,
 * we check for the presence of the 'lastLoaded' property in the network map
 * @param {Y.Map} yNetMap
 */
function checkMapExists(yNetMap) {
	const lastLoaded = yNetMap.get('lastLoaded')
	if (!lastLoaded) {
		throw new Error('Map not found.  Have you created the map through the PRSM web interface?')
	}
}
/**
 * time stamp and output message to console
 * @param {string} message
 */
function logAPICalls(message) {
	const timestamp = new Date().toLocaleString()
	console.log(`[${timestamp}] ${message}`)
}
/**
 * Add service tier to payload when provided.
 * @param {Object} payload
 * @param {string} tier
 * @returns {Object}
 */
function withServiceTier(payload, tier) {
	if (!tier) return payload
	return {...payload, serviceTier: {type: normaliseServiceTier(tier)}}
}

/**
 * Extract text from a Converse API response.
 * @param {Object} converseResponse
 * @returns {string}
 */
function extractConverseText(converseResponse) {
	const content = converseResponse?.output?.message?.content || []
	return content
		.filter((block) => typeof block?.text === 'string')
		.map((block) => block.text)
		.join('\n')
		.trim()
}

/**
 * Parse structured help response with fallback to free-form citation markers.
 * @param {string} fullAiResponse
 * @returns {{responseText: string, usedIndices: number[]}}
 */
function parseHelpAssistantResponse(fullAiResponse) {
	const responseText = fullAiResponse?.trim() || ''
	if (!responseText) return {responseText: '', usedIndices: []}

	const structured = tryParseStructuredHelpResponse(responseText)
	if (structured) {
		const cleaned = stripCitationMarkers(structured.responseText)
		return {
			responseText: cleaned.responseText,
			usedIndices: uniqueNonNegativeInts([
				...structured.usedIndices,
				...cleaned.usedIndices,
			]),
		}
	}

	return stripCitationMarkers(responseText)
}

/**
 * Try to parse a structured JSON help response, including fenced ```json blocks.
 * @param {string} responseText
 * @returns {{responseText: string, usedIndices: number[]}|null}
 */
function tryParseStructuredHelpResponse(responseText) {
	const candidates = [responseText]
	const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)```/i)
	if (fenced?.[1]) candidates.unshift(fenced[1].trim())

	for (const candidate of candidates) {
		try {
			const parsed = JSON.parse(candidate)
			if (typeof parsed?.answer_markdown === 'string') {
				return {
					responseText: parsed.answer_markdown.trim(),
					usedIndices: normaliseSourceIndexes(parsed.used_source_indexes),
				}
			}
		} catch {
			// try next candidate
		}
	}
	return null
}

/**
 * Remove free-form citation markers from answer text and collect their indices.
 * Handles USED_SOURCES tags and bare trailing index lists the model sometimes emits.
 * @param {string} responseText
 * @returns {{responseText: string, usedIndices: number[]}}
 */
function stripCitationMarkers(responseText) {
	let text = responseText
	const usedIndices = []

	text = text.replace(/USED_SOURCES:\s*\[([^\]]*)\]/gi, (_, body) => {
		usedIndices.push(...parseIndexList(body))
		return ''
	})

	// e.g. "Sources: [0, 1, 3]" or a final line that is only "[0, 1, 3]"
	text = text.replace(/(?:^|\n)\s*(?:Sources?\s*:\s*)?\[\s*\d+(?:\s*,\s*\d+)*\s*\]\s*$/i, (match) => {
		const body = match.match(/\[([^\]]*)\]/)?.[1] || ''
		usedIndices.push(...parseIndexList(body))
		return ''
	})

	return {
		responseText: text.trim(),
		usedIndices: uniqueNonNegativeInts(usedIndices),
	}
}

/**
 * @param {unknown} value
 * @returns {number[]}
 */
function normaliseSourceIndexes(value) {
	if (!Array.isArray(value)) return []
	return uniqueNonNegativeInts(
		value.map((index) => (typeof index === 'string' ? parseInt(index, 10) : index)),
	)
}

/**
 * @param {string} body
 * @returns {number[]}
 */
function parseIndexList(body) {
	return uniqueNonNegativeInts(
		String(body)
			.split(',')
			.map((num) => parseInt(num.trim(), 10)),
	)
}

/**
 * @param {number[]} indexes
 * @returns {number[]}
 */
function uniqueNonNegativeInts(indexes) {
	return [...new Set(indexes.filter((n) => Number.isInteger(n) && n >= 0))]
}

// utility functions
/**
 * Recursively updates properties in a target object with values from an update object.
 * Searches deeply through nested objects to find and update matching keys.
 * Only updates keys that already exist in the target object; it does not add new keys.
 * Stops as soon as a match is found and updated, so if there are multiple nested objects
 * with the same key, only the first one encountered will be updated.
 *
 * @param {Object} target - The object to update
 * @param {Object} updates - Object containing key-value pairs to update
 * @returns {Object} The updated target object
 */
function deepUpdate(target, updates) {
	const result = structuredClone(target)
	for (const [key, value] of Object.entries(updates)) {
		if (Object.hasOwn(result, key)) {
			result[key] = value
		} else {
			for (const prop in result) {
				if (typeof result[prop] === 'object' && result[prop] !== null) {
					if (Object.hasOwn(result[prop], key)) {
						result[prop][key] = value
						break
					}
					result[prop] = deepUpdate(result[prop], {[key]: value})
				}
			}
		}
	}
	return result
}
/**
 * return a copy of the object but omitting the properties that are in stripList
 * @param {Object} obj the object to copy
 * @param {array} stripList list of properties to omit
 * @returns {Object} copy of the object with specified properties omitted
 */
function strip(obj, stripList) {
	return Object.fromEntries(Object.entries(obj).filter(([key]) => !stripList.includes(key)))
}
/**
 * return an array of objects, each stripped to omit the listed properties
 * @param {array} arr
 * @param {array} stripList list of properties to omit
 * @returns {array} Array of stripped objects
 */
function stripArray(arr, stripList) {
	return arr.map((item) => strip(item, stripList))
}
