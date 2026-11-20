/********************************************************************************************* 

PRSM Participatory System Mapper 

MIT License

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk

This software is licenced under the PolyForm Noncommercial License 1.0.0

<https://polyformproject.org/licenses/noncommercial/1.0.0>

See the file LICENSE.md for details.

This module provides the AI Help Assistant front end for PRSM
********************************************************************************************/

import { elem, dragElement } from '../shared/utils.js'
import { marked } from 'marked'

/**
 * Ask the existing help service, preserving the conversation and room.
 * @param {string} baseUrl Service origin.
 * @param {Array<object>} messages Conversation messages.
 * @param {string} room Current room.
 * @returns {Promise<object>} Answer and optional sources.
 */
export async function requestHelp(baseUrl, messages, room) {
  const response = await fetch(`${baseUrl}/api/helpAssistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, room }),
  })
  const data = await response.json()
  if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`)
  if (typeof data.response !== 'string') throw new Error('Invalid response from the assistant')
  return data
}

/** Select the help service for the current page.
 * @param {URL} url Current page URL.
 * @returns {string} Service origin.
 */
export function helpServiceOrigin(url) {
  const isLocal = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  if (!isLocal) return 'https://prsm.uk'
  return url.searchParams.get('localApi') === '1' ? url.origin : `http://${url.hostname}:3001`
}

/** Connect the assistant to the current room and legend.
 * @param {object} options Assistant dependencies.
 * @param {string} options.room Current room.
 * @param {HTMLElement} options.legend Map legend.
 * @returns {void}
 */
export function openAIAsstDialog({ room, legend }) {
  const toggleBtn = elem('toggle-ai-assistant-btn')
  const closeBtn = elem('close-ai-assistant-btn')
  const chatDialog = elem('ai-assistant-dialog')
  const form = elem('ai-assistant-form')
  const userInput = elem('ai-assistant-user-input')
  const messagesDiv = elem('ai-assistant-messages')
  const statusDot = elem('status-dot')
  const overlay = elem('processing-overlay')
  const assistantContainer = elem('ai-assistant-container')

  dragElement(assistantContainer, elem('ai-assistant-header'))
  makeAIAssistantFabDraggable(assistantContainer, toggleBtn)

  /**
   * Toggle the AI chat dialog. Hide the map legend only when opening the chat
   * would cover it (e.g. FAB still in the default corner). If the FAB has been
   * dragged clear of the legend, leave the legend visible.
   */
  function toggleChat() {
    if (!chatDialog) return

    const opening = chatDialog.classList.contains('hidden')
    if (opening) {
      const dialogRect = getChatDialogOpenRect(chatDialog)
      chatDialog.classList.remove('hidden')
      if (!legend.hidden && rectsOverlap(dialogRect, legend.getBoundingClientRect())) {
        legend.classList.add('assistant-covered')
      }
    } else {
      chatDialog.classList.add('hidden')
      legend.classList.remove('assistant-covered')
    }
    toggleBtn.setAttribute('aria-expanded', String(opening))
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

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    sendMessage()
  })

  // Select all the suggestion buttons and add the listener
  document.querySelectorAll('.chip-btn').forEach((button) => {
    button.addEventListener('click', () => {
      sendMessage(button.textContent.trim())
    })
  })

  const chatHistory = []
  let pending = false
  const imageBaseUrl = new URL('/doc/help4/doc_build', window.location.origin).href
  const apiBaseUrl = helpServiceOrigin(new URL(window.location.href))

  /** Send a question and keep successful exchanges for follow-up questions.
   * @param {string} [prompt] Suggested question, or the input value.
   * @returns {Promise<void>}
   */
  async function sendMessage(prompt = '') {
    const message = prompt || userInput.value.trim()
    if (!message || pending) return

    pending = true
    const userMessage = { role: 'user', content: [{ text: message }] }
    const userMsgEl = appendTextMessage('user', message)
    userInput.value = ''
    overlay.hidden = false
    statusDot.classList.add('status-dot-active')

    try {
      const data = await requestHelp(apiBaseUrl, [...chatHistory, userMessage], room)
      await appendAnswer(data.response, data.sources)
      chatHistory.push(userMessage, { role: 'assistant', content: [{ text: data.response }] })
    } catch (err) {
      appendTextMessage('ai', `Error: ${err.message}`)
    } finally {
      pending = false
      overlay.hidden = true
      statusDot.classList.remove('status-dot-active')
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
    messagesDiv.scrollTo({
      top,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
  }

  /**
   * Append a plain-text message.
   * @param {string} sender Message sender.
   * @param {string} text Message text.
   * @returns {HTMLElement} Message element.
   */
  function appendTextMessage(sender, text) {
    const msgDiv = document.createElement('div')
    msgDiv.className = `message ${sender}-message`
    msgDiv.textContent = text
    messagesDiv.appendChild(msgDiv)
    return msgDiv
  }

  /**
   * Render a sanitized Markdown answer and its research sources.
   * @param {string} text Assistant response.
   * @param {Array<{name:(string|undefined),url:(string|undefined)}>} [sources] Research citations.
   * @returns {Promise<void>}
   */
  async function appendAnswer(text, sources = []) {
    const msgDiv = document.createElement('div')
    msgDiv.className = 'message ai-message'
    const html = marked.parse(text)
    if ('setHTML' in Element.prototype) {
      const sanitizer = new Sanitizer()
      sanitizer.allowElement({ name: 'img', attributes: ['src', 'alt', 'title'] })
      msgDiv.setHTML(html, { sanitizer })
    } else {
      const module = await import('dompurify')
      const DOMPurify = module.default ?? module
      msgDiv.innerHTML = DOMPurify.sanitize(html, {
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target'],
      })
    }
    for (const image of msgDiv.querySelectorAll('img')) {
      const src = image.getAttribute('src')
      if (src?.startsWith('/images/')) image.src = `${imageBaseUrl}${src}`
      image.classList.add('chat-image')
    }
    appendSources(msgDiv, sources)
    messagesDiv.appendChild(msgDiv)
  }
}

/**
 * Append valid research source links without interpreting their names as HTML.
 * @param {HTMLElement} container Answer element.
 * @param {Array<{name:(string|undefined),url:(string|undefined)}>} sources Research citations.
 * @returns {void}
 */
function appendSources(container, sources) {
  const valid = Array.isArray(sources)
    ? sources.filter(
        (source) => typeof source?.url === 'string' && /^https?:\/\//i.test(source.url.trim())
      )
    : []
  if (!valid.length) return
  const heading = document.createElement('div')
  heading.className = 'source-header'
  heading.textContent = 'Sources:'
  container.append(heading)
  for (const source of valid) {
    const link = document.createElement('a')
    link.href = source.url.trim()
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.className = 'source-link'
    link.textContent = `📖 ${source.name || 'Research Source'}`
    container.append(link)
  }
}

/**
 * Determine whether two rectangles overlap.
 * @param {DOMRectReadOnly} a
 * @param {DOMRectReadOnly} b
 * @returns {boolean}
 */
function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

/**
 * Bounding box of the chat dialog as it appears when open.
 * While `.hidden`, CSS transform shrinks/shifts the panel, so clear that for measurement.
 * @param {HTMLElement} dialog
 * @returns {DOMRect}
 */
function getChatDialogOpenRect(dialog) {
  const previousTransition = dialog.style.transition
  const previousTransform = dialog.style.transform
  dialog.style.transition = 'none'
  dialog.style.transform = 'none'
  // Force layout with the open-size transform so getBoundingClientRect is accurate.
  dialog.getBoundingClientRect()
  const rect = dialog.getBoundingClientRect()
  dialog.style.transition = previousTransition
  dialog.style.transform = previousTransform
  return rect
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
   * Keep a position within its permitted bounds.
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

  /** Cancel the delayed drag cursor. */
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

  /** Restore the normal cursor after dragging. */
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

  /** Finish a pointer drag and suppress its trailing click. */
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
