import {elem, dragElement} from './utils.js'

export function openAIAsstDialog() {
	const toggleBtn = elem('toggle-aiassistant-btn')
	const closeBtn = elem('close-aiassistant-btn')
	const chatDialog = elem('aiassistant-dialog')

    dragElement(elem('ai-assistant-container'), elem('aiassistant-header'))

	// Open / Close Toggle mechanism
	function toggleChat() {
		chatDialog.classList.toggle('hidden')
	}

	toggleBtn.addEventListener('click', toggleChat)
	closeBtn.addEventListener('click', toggleChat)
}
