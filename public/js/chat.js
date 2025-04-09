/**
 * Chat functionality for regular chat rooms
 */
import { getUsername } from './auth.js';

/**
 * Initialize the chat interface
 * Sets up event listeners and UI
 */
function initializeChat() {
  const chatMessages = document.querySelector('.chat-messages');
  const chatForm = document.getElementById('chatForm');
  const messageInput = document.getElementById('messageInput');
  
  if (!chatForm || !chatMessages || !messageInput) {
    console.error('Chat elements not found on page');
    return;
  }
  
  const username = getUsername() || 'Anonymous';
  
  // When form is submitted
  chatForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage(`${username}: ${message}`, 'user-message');
    
    // Clear input
    messageInput.value = '';
    
    // In a real app, you would send this to a server via Socket.io
    // and receive messages from other users
    // For demo, we'll simulate other users
    setTimeout(() => {
      addMessage('Other User: This is a response!', 'other-message');
    }, 1000);
  });
}

/**
 * Add a message to the chat display
 * @param {string} message - Message text to display
 * @param {string} type - CSS class for the message type (user-message, other-message)
 */
function addMessage(message, type) {
  const chatMessages = document.querySelector('.chat-messages');
  if (!chatMessages) return;
  
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', type);
  messageElement.textContent = message;
  chatMessages.appendChild(messageElement);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Only initialize on chat page
  if (window.location.pathname.includes('chat.html')) {
    initializeChat();
  }
});

export { initializeChat, addMessage }; 