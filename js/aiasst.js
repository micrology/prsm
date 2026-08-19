export function openAIAsstDialog() {
	const toggleBtn = document.getElementById("toggle-chat-btn")
	const closeBtn = document.getElementById("close-chat-btn")
	const chatDialog = document.getElementById("chat-dialog")

	// Open / Close Toggle mechanism
	function toggleChat() {
		chatDialog.classList.toggle("hidden")
	}

	toggleBtn.addEventListener("click", toggleChat)
	closeBtn.addEventListener("click", toggleChat)
}
