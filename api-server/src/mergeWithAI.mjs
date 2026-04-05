#!/usr/bin/env node
import { Command } from 'commander'
import { writeFile } from 'node:fs/promises'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import { loadSecrets } from './secrets.mjs'
import { styles } from '../../js/samples.js'


/* Merges several related maps together with assistance from an LLM.

NG 04-04-2026

Generates a PRSM map file and a Markdown documentation file.

parameters can be passed as command line arguments, e.g.:
    node merge.mjs room1 room2 room3
This will load maps from rooms 'room1', 'room2' and 'room3' and merge them together.

The following environment variables can be set:
- MODEL_ID: (optional) the Bedrock model to use, e.g. 'qwen.qwen3-235b-a22b-2507-v1:0' (default: 'qwen.qwen3-235b-a22b-2507-v1:0')
- AWS_REGION: (optional) the AWS region where your Bedrock model is hosted, e.g. 'eu-west-2' (default: 'eu-west-2')
- MAX_TOKENS: (optional) the maximum number of tokens to generate in the LLM response (default: 63000)
- MAX_PROMPT_LENGTH: (optional) the maximum length of the combined system prompt and user message (default: 100000 characters)
- DEBUG: (optional) set to any value to enable debug logging, which will include the full system prompt and LLM response in the console output.
- NODE_ENV: (optional) set to 'dev' to connect to a local WebSocket server at ws://localhost:1234 instead of the production server at wss://www.prsm.uk/wss

A Bedrock API key must be provided as secret with the name 'BEDROCK_API_KEY' - see secrets.mjs for details.  
*/

const debug = process.env.DEBUG || ''
let websocket = 'wss://www.prsm.uk/wss'
if (process.env.NODE_ENV === 'dev') {
    console.log('Running in development mode')
    websocket = 'ws://localhost:1234'
}

const context = debug
    ? ''
    : `The UK Electoral Commision is looking ahead to a programme of work over the next 12 months to identify the next set of major challenges for UK elections. System mapping will allow us to identify more comprehensively the different components of the system and the linkages between them, so that we can focus our efforts on the key points of the system that will have most significant impact. We are looking to merge together a number of different system maps that have been created by different teams across the Commission, to create a single master map that captures the full complexity of the electoral system. This will allow us to identify key leverage points for intervention and to develop more effective strategies for addressing the challenges we face.`

/**
 * Build the LLM system prompt by loading maps from rooms and composing merge instructions.
 * @param {string[]} rooms List of room identifiers whose maps should be merged.
 * @returns {Promise<string>} The assembled system prompt.
 */
async function systemPrompt(rooms) {
    const mapEntries = await Promise.all(
        rooms.map(async room => `Map from room ${room}: ${JSON.stringify(await getMap(room))}`)
    )
    const inputMaps = mapEntries.join('\n\n')
    return `Task: Merge ${rooms.length} JSON-based causal system maps into a single, deduplicated master map.

Context: ${context}

Input Data
${rooms.length} JSON files are provided below. Each contains:

1. A nodes array of objects with id (unique string), a label (descriptive string), color, grp (which defines the way the node is styled when displayed), shape, x and y (the location of the node on the map), and notes (in "delta" format - see https://quilljs.com/docs/delta).

2. An edges array of objects with id, 'from' (source node ID), 'to' (target node ID), color, grp (which defines the way the edge is styled when displayed), and notes (in "delta" format - see https://quilljs.com/docs/delta).

Core Objective:

Synthesize all nodes and edges into one unified JSON object while performing Semantic Deduplication.

Deduplication Logic:

* Nodes: Merge two or more nodes into a single entity if their label values are:

    * Identical (e.g., "Carbon Emissions" and "Carbon Emissions").

    * Synonymous (e.g., "GHG" and "Greenhouse Gases").

    * Conceptually similar (e.g., "Cost of Electricity" and "Energy Prices").

* Edges: Once nodes are merged, identify redundant edges. If multiple edges now connect the same source node to the same target node, include that relationship only once in the final map.

Technical Constraints:

* Generate new, consistent id values for the merged nodes and edges in the final map.

* Ensure that all the nodes and edges that have not been merged are retained in the final map with their original properties.

* Ignore non-essential properties (e.g., coordinates, colors) present in the source files when merging.  When merging nodes, retain the most descriptive label. Choose color, grp, shape and coordinates from one of the nodes to be merged - it does not matter which.  When merging edges, choose other properties from one of the edges being merged.

* The "note" property of nodes and edges contains rich text in "delta" format (see https://quilljs.com/docs/delta). When merging, concatenate the "ops" arrays from the "note" properties of the relevant nodes or edges to preserve all the note content, by forming one "ops" array as the "note" property of the merged node or edge, with an "insert" operation for each original node or edge's "note" property. If there is no "note" property for either of the nodes (or edges) being merged, omit the property from the node or edge.

* Maintain the directed nature of the causal links.

Required Output:

1. Merged JSON Map: A single JSON object containing a nodes array and an edges array representing the total system.

2. Synthesis Report: A table or list documenting:

    * Node Merges: Which original labels were grouped together and the reasoning for the semantic match.

    * Edge Consolidation: A summary of how links were re-mapped to the new node IDs.
    * Key Insights: Any notable patterns or clusters that emerged from the merged map.

Maps to Merge:

${inputMaps}
`
}

/**
 * Parse command-line arguments and return collected string values.
 * @param {string[]} argv Full process arguments array.
 * @returns {string[]} Collected string values.
 */
function parseCommandLine(argv) {
    const program = new Command()
    let values = []

    program
        .name('merge')
        .description('Collect an indefinite number of strings from the command line')
        .argument('[values...]', 'Strings to collect')
        .action((parsedValues = []) => {
            values = parsedValues
        })

    program.parse(argv)
    return values
}

/**
 * Load a PRSM map from a Yjs room via WebSocket.
 * @param {string} room The room identifier.
 * @returns {Promise<Object>} The map data (nodes, edges, metadata).
 */
async function getMap(room) {
    const doc = new Y.Doc()
    const wsProvider = new WebsocketProvider(websocket, `prsm${room}`, doc)
    return await new Promise((resolve, reject) => {
        wsProvider.once('synced', () => {
            try {
                const yNodesMap = doc.getMap('nodes')
                const yEdgesMap = doc.getMap('edges')
                const yNetMap = doc.getMap('network')
                checkMapExists(yNetMap)
                console.log(`Map for room ${room} loaded successfully`)
                resolve({
                    room,
                    mapTitle: yNetMap.get('mapTitle'),
                    viewOnly: yNetMap.get('viewOnly'),
                    version: yNetMap.get('version'),
                    nodes: Array.from(yNodesMap.values()).map(stripNode),
                    edges: Array.from(yEdgesMap.values()).map(stripEdge),
                })
            } catch (error) {
                reject(error)
            } finally {
                doc.destroy()
                wsProvider.disconnect()
                wsProvider.destroy()
            }
        })
    })
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
        throw new Error('Map not found')
    }
}
/**
 * return a copy of an object that only includes the properties that are in allowed
 * @param {Object} obj the object to copy
 * @param {array} allowed list of allowed properties
 */
function strip(obj, allowed) {
    return allowed.reduce((a, e) => {
        a[e] = obj[e]
        return a
    }, {})
}

/**
 * Return a node copy with a simplified color object.
 * @param {Object} node the node to normalize
 * @returns {Object}
 */
function stripNode(node) {
    const strippedNode = strip(node, ['id', 'label', 'color', 'grp', 'shape', 'x', 'y', 'note'])

    if (strippedNode.color) {
        strippedNode.color = strip(strippedNode.color, ['border', 'background'])
    }

    return strippedNode
}
/**
 * Return an edge copy with a simplified color object.
 * @param {Object} edge The edge to normalize.
 * @returns {Object}
 */
function stripEdge(edge) {
    const strippedEdge = strip(edge, ['id', 'from', 'to', 'label', 'color', 'grp', 'note'])

    if (strippedEdge.color) {
        strippedEdge.color = strip(strippedEdge.color, ['color'])
    }

    return strippedEdge
}

/**
 * Send a message to the Bedrock LLM and return the response text.
 * @param {string} message The user message to send.
 * @param {string} prompt The system prompt providing merge instructions.
 * @returns {Promise<string>} The LLM response text.
 */
async function callLLM(message, prompt) {
    const region = process.env.AWS_REGION || 'eu-west-2'
    const bedrockApiKey = process.env.BEDROCK_API_KEY
    const modelId = process.env.MODEL_ID || 'qwen.qwen3-235b-a22b-2507-v1:0'

    if (!bedrockApiKey) {
        throw new Error('BEDROCK_API_KEY environment variable is not set')
    }
    if (!message) {
        throw new Error('Message is required')
    }

    const maxPromptLength = parseInt(process.env.MAX_PROMPT_LENGTH, 10) || 100000
    if (message.length + (prompt?.length ?? 0) > maxPromptLength) {
        throw new Error(`Prompt is too long (limit: ${maxPromptLength} characters)`)
    }

    const payload = {
        modelId,
        messages: [{ role: 'user', content: [{ text: message }] }],
        system: [{ text: prompt }],
        inferenceConfig: {
            maxTokens: parseInt(process.env.MAX_TOKENS, 10) || 63000,
            temperature: 0.5,
        },
    }
    console.log(`Using ${modelId} in ${region} with max tokens ${payload.inferenceConfig.maxTokens}`)
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`
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
        throw new Error(`Bedrock API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    if (data.usage) {
        console.log(
            `Token usage - input: ${data.usage.inputTokens}, output: ${data.usage.outputTokens}, total: ${data.usage.totalTokens}`
        )
    }

    return data.output.message.content[0].text
}

/**
 * Parse the LLM response, apply styles, and write the merged map and report to disk.
 * @param {string} resultString The raw LLM response containing JSON and a synthesis report.
 */
async function writeResults(resultString) {
    const fileName = `merge-results-${new Date().toLocaleString().replace(/[/:,\s]/g, '')}`

    const json = resultString.match(/json\n([\s\S]*?)\n`/)
    if (!json) throw new Error('No JSON block found in LLM response')

    const styledJson = JSON.parse(json[1])
    // add styles to nodes and edges based on grp property, using styles from samples.js
    styledJson.nodes = styledJson.nodes.map(node => {
        if (node.grp && styles.nodes[node.grp]) {
            node = deepMerge(styles.nodes.base, styles.nodes[node.grp], node)
        }
        return node
    })
    styledJson.edges = styledJson.edges.map(edge => {
        if (edge.grp && styles.edges[edge.grp]) {
            edge = deepMerge(styles.edges.base, styles.edges[edge.grp], edge)
        }
        return edge
    })

    const report = resultString.match(/Synthesis Report[\s\S]*$/)
    if (!report) throw new Error('No Synthesis Report found in LLM response')

    await writeFile(`${fileName}.prsm`, JSON.stringify(styledJson), 'utf8')
    await writeFile(`${fileName}.md`, `# ${report[0]}`, 'utf8')
    console.log(`Results saved to ${fileName}`)
}

/**
 * Recursively merge one or more objects into a new object.
 * Later arguments take precedence over earlier ones.
 * @param {...Object} objects Objects to merge.
 * @returns {Object} The merged result.
 */
function deepMerge(...objects) {
    const newObj = {}

    function merge(obj) {
        for (const prop in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, prop)) {
                if (Object.prototype.toString.call(obj[prop]) === '[object Object]') {
                    newObj[prop] = deepMerge(newObj[prop], obj[prop])
                } else {
                    newObj[prop] = obj[prop]
                }
            }
        }
    }

    for (const obj of objects) {
        merge(obj)
    }

    return newObj
}

try {
    await loadSecrets()
    const rooms = parseCommandLine(process.argv)
    const prompt = await systemPrompt(rooms)
    const aiResponse = await callLLM('Please merge the maps as per the system prompt.', prompt)
    if (debug) console.log('AI Response:\n', aiResponse)
    await writeResults(aiResponse)
} catch (error) {
    console.error(`Fatal: ${error.message}`)
    process.exit(1)
}
