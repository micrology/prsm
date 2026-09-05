/********************************************************************************************* 

PRSM Participatory System Mapper 

MIT License

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk

This software is licenced under the PolyForm Noncommercial License 1.0.0

<https://polyformproject.org/licenses/noncommercial/1.0.0>

See the file LICENSE.md for details.

This module provides the AI Help Assistant front end for PRSM
********************************************************************************************/

import { elem, dragElement } from './utils.js'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

export function openAIAsstDialog() {
  const toggleBtn = elem('toggle-ai-assistant-btn')
  const closeBtn = elem('close-ai-assistant-btn')
  const chatDialog = elem('ai-assistant-dialog')
  const sendBtn = elem('ai-assistant-send-btn')
  const userInput = elem('ai-assistant-user-input')
  const messagesDiv = elem('ai-assistant-messages')
  const statusDot = elem('status-dot')
  const overlay = elem('processing-overlay')

  dragElement(elem('ai-assistant-container'), elem('ai-assistant-header'))

  /**
   *  Toggle the visibility of the chat dialog and legend box when the user clicks the "AI Help" 
   *    button or the "X" close button.
   *  If the chat dialog is currently hidden, show it and hide the legend box.
   *  If the chat dialog is currently visible, hide it and show the legend box.
   */
  function toggleChat() {
    chatDialog.classList.toggle('hidden')
    elem('legendBox').classList.toggle('hidden')
  }

  // Event listeners
  toggleBtn.addEventListener('click', toggleChat)
  closeBtn.addEventListener('click', toggleChat)

  sendBtn.addEventListener('click', () => sendMessage())
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage()
  })

  // Select all the suggestion buttons and add the listener
  document.querySelectorAll('.chip-btn').forEach((button) => {
    button.addEventListener('click', () => {
      sendMessage(button.textContent.trim())
    })
  })

  const chatHistory = []

  // configure image path for markdown-rendered images (e.g. from help assistant)
  const isLocal =
    window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  const IMAGE_BASE_URL = isLocal
    ? 'http://127.0.0.1/prsm/doc/help/doc_build'
    : 'https://prsm.uk/doc/help/doc_build'
  const API_BASE_URL = isLocal ? 'http://localhost:3001' : 'https://prsm.uk'
  async function sendMessage(prompt = '') {
    const message = prompt || userInput.value.trim()
    if (!message) return

    // Add User Message to UI and chat history
    chatHistory.push({ role: 'user', content: [{ text: message }] })
    const userMsgEl = appendMessage('user', message)
    userInput.value = ''
    overlay.style.display = 'block'
    statusDot.classList.add('status-dot-active')

    try {
      const response = await fetch(`${API_BASE_URL}/api/helpAssistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory }),
      })

      const data = await response.json()
      overlay.style.display = 'none'
      statusDot.classList.remove('status-dot-active')
      if (data.error) throw new Error(data.error)
      // Add AI response to history
      chatHistory.push({
        role: 'assistant',
        content: [{ text: data.response }],
      })
      // Render the AI response as Markdown
      appendMessage('ai', data.response, data.sources)
    } catch (err) {
      overlay.style.display = 'none'
      statusDot.classList.remove('status-dot-active')
      appendMessage('ai', `**Error:** ${err.message}`)
    }
    scrollUserMessageNearTop(userMsgEl)
    userInput.placeholder = 'Ask a follow-up or a new question…'
  }

  /**
   * Scroll the chat so the given user message sits near the top of the
   * viewport, leaving a few pixels of the previous answer visible above it.
   * @param {HTMLElement} userMsgEl
   */
  function scrollUserMessageNearTop(userMsgEl) {
    const PREVIOUS_PEEK_PX = 36
    const msgTop =
      userMsgEl.getBoundingClientRect().top -
      messagesDiv.getBoundingClientRect().top +
      messagesDiv.scrollTop
    const top = Math.max(0, msgTop - PREVIOUS_PEEK_PX)
    messagesDiv.scrollTo({ top, behavior: 'smooth' })
  }

  /**
   * Append a chat bubble and return the created element.
   * @param {string} sender
   * @param {string} text
   * @param {Array.<{name: string, url: (string|undefined)}>} [sources]
   * @returns {HTMLElement}
   */
  function appendMessage(sender, text, sources = []) {
    const msgDiv = document.createElement('div')
    msgDiv.className = `message ${sender}-message`

    // 1. Convert Markdown text to HTML
    const renderer = new marked.Renderer()
    renderer.image = function (token) {
      let finalHref = token.href
      // If the path is relative (starts with /images/), prepend the base URL
      if (token.href && token.href.startsWith('/images/')) {
        finalHref = `${IMAGE_BASE_URL}${token.href}`
      }
      return `<img src="${finalHref}" alt="${token.text || ''}" title="${token.title || ''}" class="chat-image" />`
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
          const title = source.name.split('/').pop().replace('.html', '').replace(/-/g, ' ')
          htmlContent += `<a href="${source.name}" target="_blank" class="source-link">📖 ${title}</a>`
        }
      })
    }
    const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'target']
    msgDiv.innerHTML = DOMPurify.sanitize(htmlContent, { ALLOWED_ATTR })

    messagesDiv.appendChild(msgDiv)
    return msgDiv
  }
}
