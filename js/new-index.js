import { marked } from 'marked'
import DOMPurify from 'dompurify'

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('processing-overlay')
  const sendBtn = document.getElementById('send-btn')
  const userInput = document.getElementById('user-input')
  const messagesDiv = document.getElementById('chat-messages')
  const chatHistory = []

  // configure image path for markdown-rendered images (e.g. from help assistant)
  const isLocal =
    window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  const IMAGE_BASE_URL = isLocal
    ? 'http://127.0.0.1/prsm/doc/help/doc_build'
    : 'https://prsm.uk/doc/help/doc_build'
  const API_BASE_URL = isLocal ? 'http://127.0.0.1:3001' : 'https://prsm.uk'
  async function sendMessage(prompt = '') {
    const message = prompt || userInput.value.trim()
    if (!message) return

    // Add User Message to UI and chat history
    chatHistory.push({ role: 'user', content: [{ text: message }] })
    appendMessage('user', message)
    userInput.value = ''
    overlay.style.display = 'block'

    try {
      const response = await fetch(`${API_BASE_URL}/api/helpAssistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory }),
      })

      const data = await response.json()
      overlay.style.display = 'none'

      if (data.error) throw new Error(data.error)
      // Add AI response to history
      chatHistory.push({ role: 'assistant', content: [{ text: data.response }] })
      // Render the AI response as Markdown
      appendMessage('ai', data.response, data.sources)
    } catch (err) {
      overlay.style.display = 'none'
      appendMessage('ai', `**Error:** ${err.message}`)
    }
  }

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
      sources.forEach((url) => {
        // Extract a readable title from the URL if possible
        const title = url.split('/').pop().replace('.html', '').replace(/-/g, ' ')
        htmlContent += `<a href="${url}" target="_blank" class="source-link">📖 ${title}</a>`
      })
    }

    msgDiv.innerHTML = DOMPurify.sanitize(htmlContent)

    // Remove any previous spacer
    const oldSpacer = messagesDiv.querySelector('.chat-spacer')
    if (oldSpacer) oldSpacer.remove()

    messagesDiv.appendChild(msgDiv)

    if (sender === 'user') {
      // Add a spacer so there is always enough overflow to scroll
      // the user message to the very top of the visible area
      const spacer = document.createElement('div')
      spacer.className = 'chat-spacer'
      spacer.style.height = messagesDiv.clientHeight + 'px'
      messagesDiv.appendChild(spacer)

      const pageY = window.scrollY
      msgDiv.scrollIntoView({ block: 'start' })
      window.scrollTo(0, pageY)
    }
  }

  sendBtn.addEventListener('click', () => sendMessage())
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage()
  })

  // Select all the suggestion buttons and add the listener
  document.querySelectorAll('.chat-suggestion').forEach((button) => {
    button.addEventListener('click', () => {
      sendMessage(button.textContent.trim())
    })
  })

  // Hamburger menu toggle
  const hamburger = document.getElementById('hamburger')
  const navButtons = document.querySelector('.nav-buttons')

  hamburger.addEventListener('click', () => {
    navButtons.classList.toggle('mobile-open')
    const expanded = navButtons.classList.contains('mobile-open')
    hamburger.setAttribute('aria-expanded', expanded)
  })

  // Close menu when a nav item is clicked
  document.querySelectorAll('.nav-menu a, .nav-menu button').forEach((item) => {
    item.addEventListener('click', () => {
      navButtons.classList.remove('mobile-open')
      hamburger.setAttribute('aria-expanded', false)
    })
  })

  // cookie policy
  window.addEventListener('load', () => {
    const cookieOverlay = document.querySelector('.cookie-overlay')
    cookieOverlay.style.display = document.cookie.indexOf('accepted_cookies=') < 0 ? 'grid' : 'none'
    const acceptCookies = document.getElementById('accept-cookies')
    acceptCookies.addEventListener('click', function () {
      document.cookie = 'accepted_cookies=yes;'
      cookieOverlay.style.display = 'none'
    })
    const closeCookies = document.getElementById('close-cookies')
    closeCookies.addEventListener('click', function () {
      cookieOverlay.style.display = 'none'
    })
  })

  // Show popup after 10 seconds
  setTimeout(() => {
    document.getElementById('mc_embed_signup').style.visibility = 'visible'
  }, 10000)

  // Close button event
  document.getElementById('closeBtn').onclick = function () {
    document.getElementById('mc_embed_shell').style.display = 'none'
  }
})
