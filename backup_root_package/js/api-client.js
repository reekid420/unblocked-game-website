/**
 * API client for backend communication
 * Handles all API requests to the server
 */

class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl || window.location.origin;
    this.token = localStorage.getItem('authToken');
  }

  /**
   * Check if user is logged in
   * @returns {boolean} Whether the user is logged in
   */
  isLoggedIn() {
    return !!this.token;
  }

  /**
   * Set auth token
   * @param {string} token - JWT token
   */
  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  /**
   * Clear auth token
   */
  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  /**
   * Get headers with auth token if available
   * @returns {Object} Headers object
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Make an API request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/ai${endpoint}`;
    
    const fetchOptions = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(url, fetchOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Response data
   */
  async register(userData) {
    const data = await this.request('/users/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  /**
   * Login a user
   * @param {Object} credentials - User login credentials
   * @returns {Promise<Object>} User and token data
   */
  async login(credentials) {
    const data = await this.request('/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  /**
   * Logout the current user
   * @returns {Promise<void>}
   */
  async logout() {
    this.clearToken();
  }

  /**
   * Get user profile
   * @returns {Promise<Object>} User profile data
   */
  async getProfile() {
    return this.request('/users/profile');
  }

  /**
   * Get chat rooms
   * @returns {Promise<Array>} List of chat rooms
   */
  async getChats() {
    return this.request('/chats');
  }

  /**
   * Create a new chat room
   * @param {Object} chatData - Chat room data
   * @returns {Promise<Object>} Created chat data
   */
  async createChat(chatData) {
    return this.request('/chats', {
      method: 'POST',
      body: JSON.stringify(chatData)
    });
  }

  /**
   * Get messages for a chat room
   * @param {string} chatId - Chat room ID
   * @returns {Promise<Array>} List of messages
   */
  async getChatMessages(chatId) {
    return this.request(`/chats/${chatId}/messages`);
  }

  /**
   * Send a message to a chat room
   * @param {string} chatId - Chat room ID
   * @param {string} content - Message content
   * @returns {Promise<Object>} Created message data
   */
  async sendChatMessage(chatId, content) {
    return this.request(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }

  /**
   * Get game saves for the user
   * @returns {Promise<Array>} List of game saves
   */
  async getGameSaves() {
    return this.request('/game-saves');
  }

  /**
   * Get a specific game save
   * @param {string} gameId - Game identifier
   * @returns {Promise<Object>} Game save data
   */
  async getGameSave(gameId) {
    return this.request(`/game-saves/${gameId}`);
  }

  /**
   * Save game progress
   * @param {string} gameId - Game identifier
   * @param {Object} saveData - Game save data
   * @returns {Promise<Object>} Created save data
   */
  async saveGame(gameId, saveData) {
    return this.request(`/game-saves/${gameId}`, {
      method: 'POST',
      body: JSON.stringify({ saveData })
    });
  }

  /**
   * Log a proxied URL
   * @param {string} url - The URL that was proxied
   * @returns {Promise<Object>} Created log entry
   */
  async logProxyUrl(url) {
    return this.request('/proxy-log', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
  }

  /**
   * Get proxy history for the user
   * @returns {Promise<Array>} List of proxied URLs
   */
  async getProxyHistory() {
    return this.request('/proxy-log');
  }

  /**
   * Send a message to the AI
   * @param {string} message - The message to send
   * @returns {Promise<Object>} AI response
   */
  async sendAiMessage(message) {
    return this.request('/ai-chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }
}

// Export the API client as a singleton
const apiClient = new ApiClient();
export default apiClient; 