/**
 * AI Chat functionality with real-time Socket.IO communication
 */
import { getUsername, getToken } from './auth.js';

// Track socket connection and attempts
let socket = null;
let connectionAttempts = 0;
let isConnecting = false;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Initialize the AI chat interface
 * Sets up event listeners and UI
 */
/**
 * Connect to the Socket.IO server
 * @returns {Object} The socket connection object
 */
function connectSocket() {
  if (socket && socket.connected) {
    console.log('Socket is already connected');
    return socket;
  }
  
  if (isConnecting) {
    console.log('Socket connection attempt already in progress');
    return null;
  }
  
  isConnecting = true;
  connectionAttempts++;
  
  // Show connection status to user
  const statusElement = document.getElementById('connection-status');
  if (statusElement) {
    statusElement.textContent = 'Connecting to chat server...';
    statusElement.classList.add('connecting');
    statusElement.classList.remove('connected', 'error');
  }
  
  console.log(`Connecting to Socket.IO (Attempt ${connectionAttempts})`);
  
  // Create socket connection with timeout and error handling
  try {
    // Initialize Socket.IO with proper error handling and reconnection settings
    socket = io({
      path: '/socket.io/',
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      transports: ['websocket', 'polling'] // Try WebSocket first, fall back to polling
    });
    
    // Setup socket event handlers
    socket.on('connect', () => {
      console.log('Socket.IO connected successfully');
      isConnecting = false;
      connectionAttempts = 0;
      
      if (statusElement) {
        statusElement.textContent = 'Connected to chat server';
        statusElement.classList.add('connected');
        statusElement.classList.remove('connecting', 'error');
      }
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      
      if (statusElement) {
        statusElement.textContent = `Connection error: ${error.message}`;
        statusElement.classList.add('error');
        statusElement.classList.remove('connecting', 'connected');
      }
      
      isConnecting = false;
      
      // If we've exceeded max attempts, show permanent error
      if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
        if (statusElement) {
          statusElement.textContent = 'Failed to connect to chat server. Please reload the page.';
        }
        // Add a reload button
        const reloadBtn = document.createElement('button');
        reloadBtn.textContent = 'Reconnect';
        reloadBtn.classList.add('reconnect-btn');
        reloadBtn.addEventListener('click', () => {
          connectionAttempts = 0;
          connectSocket();
        });
        
        if (statusElement && !statusElement.querySelector('.reconnect-btn')) {
          statusElement.appendChild(reloadBtn);
        }
      }
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`Socket.IO disconnected: ${reason}`);
      
      if (statusElement) {
        statusElement.textContent = `Disconnected: ${reason}`;
        statusElement.classList.add('error');
        statusElement.classList.remove('connecting', 'connected');
      }
      
      isConnecting = false;
    });
    
    socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });
    
    return socket;
  } catch (error) {
    console.error('Error initializing Socket.IO:', error);
    isConnecting = false;
    
    if (statusElement) {
      statusElement.textContent = `Failed to initialize chat: ${error.message}`;
      statusElement.classList.add('error');
      statusElement.classList.remove('connecting', 'connected');
    }
    
    return null;
  }
}

function initializeAiChat() {
  const chatMessages = document.querySelector('.chat-messages');
  const chatForm = document.getElementById('aiChatForm');
  const messageInput = document.getElementById('messageInput');
  
  if (!chatForm || !chatMessages || !messageInput) {
    console.error('AI Chat elements not found on page');
    return;
  }
  
  // Create status indicator if it doesn't exist
  if (!document.getElementById('connection-status')) {
    const statusElement = document.createElement('div');
    statusElement.id = 'connection-status';
    statusElement.textContent = 'Initializing chat...';
    document.querySelector('.chat-container')?.insertBefore(statusElement, chatMessages);
  }
  
  // Connect to Socket.IO
  const socket = connectSocket();
  if (!socket) {
    console.error('Failed to initialize Socket.IO connection');
    addMessage('System: Unable to connect to chat server. Please try reloading the page.', 'system-message');
    return;
  }
  
  const username = getUsername() || 'Anonymous';
  
  // Set up Socket.IO event listeners for AI chat
  socket.on('ai-response', (data) => {
    console.log('Received AI response:', data);
    
    // Find and remove loading indicator
    const loadingIndicator = document.querySelector('.message.loading');
    if (loadingIndicator) {
      chatMessages.removeChild(loadingIndicator);
    }
    
    // Add AI response to chat
    addMessage(`AI: ${data.message}`, 'ai-message');
    
    // Acknowledge receipt if supported
    if (typeof data.requestId === 'string' && socket.connected) {
      socket.emit('response-received', {
        requestId: data.requestId,
        received: true
      });
    }
  });
  
  // When form is submitted
  chatForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Check if socket is connected
    if (!socket.connected) {
      addMessage('System: Connection to chat server lost. Attempting to reconnect...', 'system-message');
      socket.connect();
      setTimeout(() => {
        if (!socket.connected) {
          addMessage('System: Still unable to connect. Please try again later.', 'system-message');
        }
      }, 3000);
      return;
    }
    
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
    
    // Generate a unique request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Send message to server via Socket.IO
    socket.emit('ai-message', {
      message: message,
      username: username,
      token: getToken(), // Get auth token if user is logged in
      requestId: requestId,
      timestamp: new Date().toISOString()
    });
    
    // Set a timeout for response
    const responseTimeout = setTimeout(() => {
      // Check if loading indicator still exists
      const loadingIndicator = document.querySelector('.message.loading');
      if (loadingIndicator) {
        chatMessages.removeChild(loadingIndicator);
        addMessage('AI: Sorry, I\'m taking too long to respond. Please try again.', 'ai-message error');
      }
    }, 30000); // 30 second timeout
    
    // Clear timeout when response is received
    socket.once('ai-response', () => {
      clearTimeout(responseTimeout);
    });
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

/**
 * Create connection status UI element
 */
function createConnectionUI() {
  const container = document.querySelector('.chat-container');
  if (!container) return;
  
  // Add connection status element if not present
  if (!document.getElementById('connection-status')) {
    const statusElement = document.createElement('div');
    statusElement.id = 'connection-status';
    statusElement.textContent = 'Initializing chat connection...';
    container.insertBefore(statusElement, container.firstChild);
  }
  
  // Add styles for connection status
  if (!document.getElementById('socket-io-styles')) {
    const style = document.createElement('style');
    style.id = 'socket-io-styles';
    style.textContent = `
      #connection-status {
        padding: 8px 12px;
        margin-bottom: 10px;
        border-radius: 4px;
        font-size: 14px;
        transition: all 0.3s ease;
      }
      #connection-status.connecting {
        background-color: #f8f9fa;
        border-left: 4px solid #0d6efd;
      }
      #connection-status.connected {
        background-color: #d1e7dd;
        border-left: 4px solid #198754;
      }
      #connection-status.error {
        background-color: #f8d7da;
        border-left: 4px solid #dc3545;
      }
      .reconnect-btn {
        margin-left: 10px;
        padding: 4px 8px;
        background-color: #0d6efd;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .system-message {
        font-style: italic;
        color: #6c757d;
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize AI chat when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Only initialize on AI chat page
  if (window.location.pathname.includes('ai-chat.html')) {
    createConnectionUI();
    initializeAiChat();
  }
});

export { initializeAiChat, addMessage, connectSocket }; 