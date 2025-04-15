/**
 * Python Proxy Client
 * Handles communication with the Python FastAPI proxy server
 */

// Set the Python proxy URL
const PYTHON_PROXY_URL = '/proxy';

class PythonProxyClient {
  constructor(baseUrl = PYTHON_PROXY_URL) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('authToken');
    this.initialized = false;
    this.initPromise = null;
    
    // Logger for debugging
    this.logger = {
      info: (message, ...args) => console.log(`[PythonProxy] ${message}`, ...args),
      warn: (message, ...args) => console.warn(`[PythonProxy] ${message}`, ...args),
      error: (message, ...args) => console.error(`[PythonProxy] ${message}`, ...args)
    };
  }

  /**
   * Initialize the proxy client
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }
    
    if (this.initPromise) {
      return this.initPromise;
    }
    
    this.initPromise = new Promise(async (resolve) => {
      try {
        // Check if the Python proxy is available
        const healthCheck = await this.checkHealth();
        this.logger.info('Python proxy health check:', healthCheck);
        
        if (healthCheck.status === 'healthy') {
          this.initialized = true;
          this.logger.info('Python proxy client initialized successfully');
          resolve(true);
        } else {
          this.logger.error('Python proxy is not healthy');
          resolve(false);
        }
      } catch (error) {
        this.logger.error('Failed to initialize Python proxy client:', error);
        resolve(false);
      } finally {
        this.initPromise = null;
      }
    });
    
    return this.initPromise;
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
   * Set auth token
   * @param {string} token - JWT token
   */
  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  /**
   * Check if the Python proxy is healthy
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return await response.json();
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Send a proxied request through the Python proxy
   * @param {string} url - Target URL to proxy
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Response data
   */
  async proxyRequest(url, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Encode the URL for the proxy
    const encodedUrl = btoa(url);
    
    try {
      // Prepare request options
      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {})
        }
      };
      
      // Add body for non-GET requests
      if (options.body && requestOptions.method !== 'GET') {
        requestOptions.body = typeof options.body === 'string' 
          ? options.body 
          : JSON.stringify(options.body);
      }
      
      // Add query parameters
      const queryParams = new URLSearchParams();
      if (options.cache === false) {
        queryParams.append('cache', 'false');
      }
      if (options.timeout) {
        queryParams.append('timeout', options.timeout);
      }
      
      const queryString = queryParams.toString();
      const requestUrl = `${this.baseUrl}/proxy/${encodedUrl}${queryString ? `?${queryString}` : ''}`;
      
      this.logger.info(`Proxying request to: ${url}`);
      const response = await fetch(requestUrl, requestOptions);
      
      // Check for error responses
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Proxy request failed');
      }
      
      // Parse response based on content type
      const contentType = response.headers.get('Content-Type') || '';
      
      if (contentType.includes('application/json')) {
        return await response.json();
      } else if (contentType.includes('text/')) {
        return await response.text();
      } else {
        return await response.blob();
      }
    } catch (error) {
      this.logger.error(`Proxy request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send a chat message to the AI
   * @param {Object} messageData - Chat message data
   * @returns {Promise<Object>} AI response
   */
  async sendChatMessage(messageData) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/ai/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(messageData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Chat request failed');
      }
      
      return await response.json();
    } catch (error) {
      this.logger.error(`Chat request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get suggested topics from the AI
   * @returns {Promise<Object>} Topics data
   */
  async getSuggestedTopics() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/ai/topics`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Topics request failed');
      }
      
      return await response.json();
    } catch (error) {
      this.logger.error(`Topics request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get conversation history
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Conversation data
   */
  async getConversation(conversationId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/ai/conversations/${conversationId}`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Conversation request failed');
      }
      
      return await response.json();
    } catch (error) {
      this.logger.error(`Conversation request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Response data
   */
  async deleteConversation(conversationId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/ai/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Delete conversation failed');
      }
      
      return await response.json();
    } catch (error) {
      this.logger.error(`Delete conversation failed: ${error.message}`);
      throw error;
    }
  }
}

// Create and export a singleton instance
const pythonProxyClient = new PythonProxyClient();
export default pythonProxyClient;
