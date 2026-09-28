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

/**
 * Current map room from the page URL, if present.
 * Read at request time (not via import from prsm.js) to avoid a circular dependency.
 * @returns {string | null}
 */
function currentRoom() {
  try {
    const value = new URL(document.location).searchParams.get('room')
    return value ? value.trim().toUpperCase() : null
  } catch {
    return null
  }
}

export function openAIAsstDialog() {
  const toggleBtn = elem('toggle-ai-assistant-btn')
  const closeBtn = elem('close-ai-assistant-btn')
  const chatDialog = elem('ai-assistant-dialog')
  const sendBtn = elem('ai-assistant-send-btn')
  const userInput = elem('ai-assistant-user-input')
  const messagesDiv = elem('ai-assistant-messages')
  const statusDot = elem('status-dot')
  const overlay = elem('processing-overlay')
  const assistantContainer = elem('ai-assistant-container')

  dragElement(assistantContainer, elem('ai-assistant-header'))
  makeAIAssistantFabDraggable(assistantContainer, toggleBtn)

  /**
   *  Toggle the visibility of the chat dialog and legend box when the user clicks the "AI Help"
   *    button or the "X" close button.
   *  If the chat dialog is currently hidden, show it and hide the legend box.
   *  If the chat dialog is currently visible, hide it and show the legend box.
   *  legendBox is only present when the map legend is shown, so it may be absent.
   */
  function toggleChat() {
    chatDialog?.classList.toggle('hidden')
    elem('legendBox')?.classList.toggle('hidden')
  }

  // Event listeners
  // Click opens/closes the assistant; drag reposition is handled separately and suppresses click.
  toggleBtn.addEventListener('click', (event) => {
    if (toggleBtn.dataset.suppressClick === 'true') {
      event.preventDefault()
      event.stopPropagation()
      delete toggleBtn.dataset.suppressClick
      return
    }
    toggleChat()
  })
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
        body: JSON.stringify({ messages: chatHistory, room: currentRoom() }),
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

    // 2. Append research sources only (manual answers intentionally have none)
    const citableSources = (sources || []).filter(
      (source) =>
        source && typeof source.url === 'string' && /^https?:\/\//i.test(source.url.trim())
    )
    if (citableSources.length > 0) {
      htmlContent += `<div class="source-header">Sources:</div>`
      citableSources.forEach((source) => {
        htmlContent += `<a href="${source.url.trim()}" target="_blank" class="source-link">📖 ${source.name || 'Research Source'}</a>`
      })
    }
    const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'target']
    msgDiv.innerHTML = DOMPurify.sanitize(htmlContent, { ALLOWED_ATTR })

    messagesDiv.appendChild(msgDiv)
    return msgDiv
  }
}

/**
 * Allow the AI assistant FAB to be dragged to a new spot on the net-pane.
 * A short press still activates the button; only movement past a threshold repositions.
 * Position is kept for the page session (until reload).
 * @param {HTMLElement} container
 * @param {HTMLElement} fabBtn
 */
function makeAIAssistantFabDraggable(container, fabBtn) {
  if (!container || !fabBtn) return

  const DRAG_THRESHOLD_PX = 5
  /** Hold this long before the cursor switches to grabbing (drag affordance). */
  const DRAG_CURSOR_DELAY_MS = 150
  let activePointerId = null
  let startClientX = 0
  let startClientY = 0
  let originContainerLeft = 0
  let originContainerTop = 0
  let originFabLeft = 0
  let originFabTop = 0
  let fabWidth = 0
  let fabHeight = 0
  let fabOffsetX = 0
  let fabOffsetY = 0
  let isDragging = false
  let dragCursorTimer = null

  /**
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clamp(value, min, max) {
    if (max < min) return min
    return Math.min(Math.max(value, min), max)
  }

  /**
   * Constrain the FAB to the net-pane when available.
   * @returns {{left: number, top: number, right: number, bottom: number}}
   */
  function getDragBounds() {
    const pane = elem('net-pane')
    if (pane) {
      const rect = pane.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    }
    return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
  }

  /**
   * Switch from CSS bottom/left anchoring to explicit top/left so dragging is stable.
   * @param {number} left
   * @param {number} top
   */
  function lockContainerPosition(left, top) {
    container.style.left = `${left}px`
    container.style.top = `${top}px`
    container.style.bottom = 'auto'
    container.style.right = 'auto'
  }

  function clearDragCursorTimer() {
    if (dragCursorTimer !== null) {
      clearTimeout(dragCursorTimer)
      dragCursorTimer = null
    }
  }

  /** Show grabbing cursor while pressed long enough or actively dragging. */
  function showDragCursor() {
    container.classList.add('is-dragging')
    // Keep grabbing even when the pointer leaves the button (e.g. over the map).
    document.documentElement.classList.add('ai-assistant-fab-grabbing')
  }

  function hideDragCursor() {
    container.classList.remove('is-dragging')
    document.documentElement.classList.remove('ai-assistant-fab-grabbing')
  }

  /**
   * Begin a drag once the pointer has moved far enough.
   * Cursor may already be grabbing from the hold delay; click is only suppressed after real movement.
   */
  function beginDrag() {
    if (isDragging || activePointerId === null) return
    isDragging = true
    clearDragCursorTimer()
    showDragCursor()
    lockContainerPosition(originContainerLeft, originContainerTop)
  }

  function endDrag(event) {
    if (activePointerId === null || event.pointerId !== activePointerId) return

    clearDragCursorTimer()

    if (fabBtn.hasPointerCapture(event.pointerId)) {
      fabBtn.releasePointerCapture(event.pointerId)
    }

    if (isDragging) {
      // Prevent the trailing click from toggling the assistant after a drag.
      fabBtn.dataset.suppressClick = 'true'
    }

    activePointerId = null
    isDragging = false
    hideDragCursor()
  }

  fabBtn.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return

    activePointerId = event.pointerId
    startClientX = event.clientX
    startClientY = event.clientY
    isDragging = false
    delete fabBtn.dataset.suppressClick
    clearDragCursorTimer()

    const containerRect = container.getBoundingClientRect()
    const fabRect = fabBtn.getBoundingClientRect()
    originContainerLeft = containerRect.left
    originContainerTop = containerRect.top
    originFabLeft = fabRect.left
    originFabTop = fabRect.top
    fabWidth = fabRect.width
    fabHeight = fabRect.height
    fabOffsetX = fabRect.left - containerRect.left
    fabOffsetY = fabRect.top - containerRect.top

    fabBtn.setPointerCapture(event.pointerId)

    // Arrow on hover; after a short hold while pressed, switch to grabbing hand.
    dragCursorTimer = setTimeout(() => {
      dragCursorTimer = null
      if (activePointerId === null) return
      showDragCursor()
    }, DRAG_CURSOR_DELAY_MS)
  })

  fabBtn.addEventListener('pointermove', (event) => {
    if (activePointerId === null || event.pointerId !== activePointerId) return

    const deltaX = event.clientX - startClientX
    const deltaY = event.clientY - startClientY

    if (!isDragging) {
      if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return
      beginDrag()
    }

    // Keep the FAB on the net-pane; the chat panel may extend outside.
    const bounds = getDragBounds()
    const nextFabLeft = clamp(originFabLeft + deltaX, bounds.left, bounds.right - fabWidth)
    const nextFabTop = clamp(originFabTop + deltaY, bounds.top, bounds.bottom - fabHeight)

    lockContainerPosition(nextFabLeft - fabOffsetX, nextFabTop - fabOffsetY)
  })

  fabBtn.addEventListener('pointerup', endDrag)
  fabBtn.addEventListener('pointercancel', endDrag)
}
