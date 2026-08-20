import { elem, dragElement } from "./utils.js"
import { marked } from "marked"
import DOMPurify from "dompurify"

export function openAIAsstDialog() {
	const toggleBtn = elem("toggle-aiassistant-btn")
	const closeBtn = elem("close-aiassistant-btn")
	const chatDialog = elem("aiassistant-dialog")
	const sendBtn = elem("aiassistant-send-btn")
	const userInput = elem("aiassistant-user-input")
	const messagesDiv = elem("aiassistant-messages")
const overlay = document.getElementById('processing-overlay')

	dragElement(elem("ai-assistant-container"), elem("aiassistant-header"))

	// Open / Close Toggle mechanism
	function toggleChat() {
		chatDialog.classList.toggle("hidden")
	}

	// Event listeners
	toggleBtn.addEventListener("click", toggleChat)
	closeBtn.addEventListener("click", toggleChat)

	sendBtn.addEventListener("click", () => sendMessage())
	userInput.addEventListener("keypress", (e) => {
		if (e.key === "Enter") sendMessage()
	})

	// Select all the suggestion buttons and add the listener
	document.querySelectorAll(".chip-btn").forEach((button) => {
		button.addEventListener("click", () => {
			sendMessage(button.textContent.trim())
		})
	})

	/* const overlay = document.getElementById('processing-overlay')
  const sendBtn = document.getElementById('send-btn')
  const copyChat = document.getElementById('copy-chat')
  const newChat = document.getElementById('new-chat')
  const userInput = document.getElementById('user-input')
  const messagesDiv = document.getElementById('chat-messages') */
	let chatHistory = []

	// configure image path for markdown-rendered images (e.g. from help assistant)
	const isLocal =
		window.location.hostname === "127.0.0.1" ||
		window.location.hostname === "localhost"
	const IMAGE_BASE_URL = isLocal
		? "http://127.0.0.1/prsm/doc/help/doc_build"
		: "https://prsm.uk/doc/help/doc_build"
	const API_BASE_URL = isLocal ? "http://localhost:3001" : "https://prsm.uk"
	async function sendMessage(prompt = "") {
		const message = prompt || userInput.value.trim()
		if (!message) return

		// Add User Message to UI and chat history
		chatHistory.push({ role: "user", content: [{ text: message }] })
		appendMessage("user", message)
		userInput.value = ""
		overlay.style.display = "block"

		try {
			const response = await fetch(`${API_BASE_URL}/api/helpAssistant`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messages: chatHistory }),
			})

			const data = await response.json()
			overlay.style.display = "none"

			if (data.error) throw new Error(data.error)
			// Add AI response to history
			chatHistory.push({
				role: "assistant",
				content: [{ text: data.response }],
			})
			// Render the AI response as Markdown
			appendMessage("ai", data.response, data.sources)
		} catch (err) {
			overlay.style.display = "none"
			appendMessage("ai", `**Error:** ${err.message}`)
		}
	}

	function appendMessage(sender, text, sources = []) {
		const msgDiv = document.createElement("div")
		msgDiv.className = `message ${sender}-message`

		// 1. Convert Markdown text to HTML
		const renderer = new marked.Renderer()
		renderer.image = function (token) {
			let finalHref = token.href
			// If the path is relative (starts with /images/), prepend the base URL
			if (token.href && token.href.startsWith("/images/")) {
				finalHref = `${IMAGE_BASE_URL}${token.href}`
			}
			return `<img src="${finalHref}" alt="${token.text || ""}" title="${token.title || ""}" class="chat-image" />`
		}
		marked.use({ renderer })
		let htmlContent = marked.parse(text)

		// 2. Append Sources if they exist
		if (sources.length > 0) {
			htmlContent += `<div class="source-header">Sources:</div>`
			sources.forEach((source) => {
				// source is now an object: { name, url }
				if (source.url) {
					// If we have a URL, make it a real link
					htmlContent += `<a href="${source.url}" target="_blank" class="source-link">📖 ${source.name}</a>`
				} else {
					// Fallback for sources without source.url: name is a link to a local file path.  Extract a readable title from it
					const title = source.name
						.split("/")
						.pop()
						.replace(".html", "")
						.replace(/-/g, " ")
					htmlContent += `<a href="${source.name}" target="_blank" class="source-link">📖 ${title}</a>`
				}
			})
		}
		const ALLOWED_ATTR = ["href", "src", "alt", "title", "class", "target"]
		msgDiv.innerHTML = DOMPurify.sanitize(htmlContent, { ALLOWED_ATTR })

		// Remove any previous spacer
		const oldSpacer = messagesDiv.querySelector(".chat-spacer")
		if (oldSpacer) oldSpacer.remove()

		messagesDiv.appendChild(msgDiv)

		if (sender === "user") {
			// Add a spacer so there is always enough overflow to scroll
			// the user message to the very top of the visible area
			const spacer = document.createElement("div")
			spacer.className = "chat-spacer"
			spacer.style.height = messagesDiv.clientHeight + "px"
			messagesDiv.appendChild(spacer)

			const pageY = window.scrollY
			msgDiv.scrollIntoView({ block: "start" })
			window.scrollTo(0, pageY)
		}
	}
}
