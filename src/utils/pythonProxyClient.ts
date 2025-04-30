// Python Proxy Client (converted from legacy python-proxy-client.js)
// Handles communication with the Python FastAPI proxy server

const PYTHON_PROXY_URL = '/proxy';

class PythonProxyClient {
  baseUrl: string;
  token: string | null;
  initialized: boolean;
  initPromise: Promise<boolean> | null;
  logger: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };

  constructor(baseUrl: string = PYTHON_PROXY_URL) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('authToken');
    this.initialized = false;
    this.initPromise = null;
    this.logger = {
      info: (message: any, ...args: any[]) => console.log(`[PythonProxy] ${message}`, ...args),
      warn: (message: any, ...args: any[]) => console.warn(`[PythonProxy] ${message}`, ...args),
      error: (message: any, ...args: any[]) => console.error(`[PythonProxy] ${message}`, ...args)
    };
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise(async (resolve) => {
      try {
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

  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  async checkHealth(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return await response.json();
    } catch (error: any) {
      this.logger.error('Health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }

  async proxyRequest(url: string, options: any = {}): Promise<any> {
    if (!this.initialized) await this.initialize();
    const encodedUrl = btoa(url);
    try {
      const requestOptions: RequestInit = {
        method: options.method || 'GET',
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {})
        }
      };
      if (options.body && requestOptions.method !== 'GET') {
        requestOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }
      const queryParams = new URLSearchParams();
      if (options.cache === false) queryParams.append('cache', 'false');
      if (options.timeout) queryParams.append('timeout', options.timeout);
      const queryString = queryParams.toString();
      const requestUrl = `${this.baseUrl}/proxy/${encodedUrl}${queryString ? `?${queryString}` : ''}`;
      this.logger.info(`Proxying request to: ${url}`);
      const response = await fetch(requestUrl, requestOptions);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Proxy request failed');
      }
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      } else if (contentType.includes('text/')) {
        return await response.text();
      } else {
        return await response.blob();
      }
    } catch (error: any) {
      this.logger.error(`Proxy request failed: ${error.message}`);
      throw error;
    }
  }

  async sendChatMessage(messageData: any): Promise<any> {
    if (!this.initialized) await this.initialize();
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
    } catch (error: any) {
      this.logger.error(`Chat request failed: ${error.message}`);
      throw error;
    }
  }

  async getSuggestedTopics(): Promise<any> {
    if (!this.initialized) await this.initialize();
    try {
      const response = await fetch(`${this.baseUrl}/ai/topics`, {
        headers: this.getHeaders()
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Topics request failed');
      }
      return await response.json();
    } catch (error: any) {
      this.logger.error(`Topics request failed: ${error.message}`);
      throw error;
    }
  }

  async getConversation(conversationId: string): Promise<any> {
    if (!this.initialized) await this.initialize();
    try {
      const response = await fetch(`${this.baseUrl}/ai/conversations/${conversationId}`, {
        headers: this.getHeaders()
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Conversation request failed');
      }
      return await response.json();
    } catch (error: any) {
      this.logger.error(`Conversation request failed: ${error.message}`);
      throw error;
    }
  }

  async deleteConversation(conversationId: string): Promise<any> {
    if (!this.initialized) await this.initialize();
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
    } catch (error: any) {
      this.logger.error(`Delete conversation failed: ${error.message}`);
      throw error;
    }
  }
}

// Create and export a singleton instance
const pythonProxyClient = new PythonProxyClient();
export default pythonProxyClient;
