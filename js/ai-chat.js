/**
 * AI Chat functionality 
 */
import { getUsername } from './auth.js';

/**
 * Initialize the AI chat interface
 * Sets up event listeners and UI
 */
function initializeAiChat() {
  const chatMessages = document.querySelector('.chat-messages');
  const chatForm = document.getElementById('aiChatForm');
  const messageInput = document.getElementById('messageInput');
  
  if (!chatForm || !chatMessages || !messageInput) {
    console.error('AI Chat elements not found on page');
    return;
  }
  
  const username = getUsername() || 'Anonymous';
  
  // When form is submitted
  chatForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage(`You: ${message}`, 'user-message');
    
    // Clear input
    messageInput.value = '';
    
    // Show loading indicator
    const loadingElement = document.createElement('div');
    loadingElement.classList.add('message', 'ai-message', 'loading');
    loadingElement.textContent = 'AI is thinking...';
    chatMessages.appendChild(loadingElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // In a real app, you would call the Gemini API here via API client
    // For demo, we'll simulate AI responses
    setTimeout(() => {
      // Remove loading indicator
      chatMessages.removeChild(loadingElement);
      
      const aiResponses = [
        "I'm an AI assistant, how can I help you?",
        "That's an interesting question. Let me think about that.",
        "Here's some information that might help you.",
        "I'm sorry, I don't have that information.",
        "Could you provide more details about your question?"
      ];
      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      addMessage(`AI: ${randomResponse}`, 'ai-message');
    }, 1000);
  });
  
  // Add suggested topics if they exist
  const topicsContainer = document.querySelector('.suggested-topics');
  if (topicsContainer) {
    const topics = [
      "Math homework help",
      "Science concepts explained",
      "History essay research",
      "Language learning tips",
      "Coding tutorials"
    ];
    
    topics.forEach(topic => {
      const topicElement = document.createElement('div');
      topicElement.classList.add('topic');
      topicElement.textContent = topic;
      topicElement.addEventListener('click', () => {
        messageInput.value = topic;
        // Focus the input
        messageInput.focus();
      });
      topicsContainer.appendChild(topicElement);
    });
  }
}

/**
 * Add a message to the AI chat display
 * @param {string} message - Message text to display
 * @param {string} type - CSS class for the message type (user-message, ai-message)
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

// Initialize AI chat when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Only initialize on AI chat page
  if (window.location.pathname.includes('ai-chat.html')) {
    initializeAiChat();
  }
});

export { initializeAiChat, addMessage }; 