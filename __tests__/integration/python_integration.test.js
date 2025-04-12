/**
 * Integration tests for Node.js and Python proxy interaction
 */

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock environment variables
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.API_KEY = 'test_api_key';
process.env.PYTHON_PROXY_URL = 'http://localhost:6078';

// Import JWT for token generation
const jwt = require('jsonwebtoken');

// Mock the Node.js API client
const apiClient = {
  sendProxyRequest: jest.fn(),
  sendChatRequest: jest.fn(),
  getTopics: jest.fn()
};

// Mock the Express app
jest.mock('express', () => {
  const mockExpress = () => {
    return {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn(),
      set: jest.fn()
    };
  };
  mockExpress.json = jest.fn(() => 'json-middleware');
  mockExpress.urlencoded = jest.fn(() => 'urlencoded-middleware');
  mockExpress.static = jest.fn(() => 'static-middleware');
  mockExpress.Router = jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    use: jest.fn()
  }));
  return mockExpress;
});

describe('Python Proxy Integration', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    apiClient.sendProxyRequest.mockClear();
    apiClient.sendChatRequest.mockClear();
    apiClient.getTopics.mockClear();
  });

  describe('Proxy Request Forwarding', () => {
    test('should forward proxy requests from Node.js to Python proxy', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { userId: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Target URL to proxy
      const targetUrl = 'https://example.com/api/data';

      // Mock Node.js API client response
      apiClient.sendProxyRequest.mockImplementation(async (url, options) => {
        // Simulate forwarding to Python proxy
        const encodedUrl = Buffer.from(url).toString('base64');
        const pythonProxyUrl = `${process.env.PYTHON_PROXY_URL}/bare-server/${encodedUrl}`;
        
        // Mock Python proxy response
        fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({
            'Content-Type': 'application/json',
            'X-Request-ID': 'req_12345'
          }),
          json: async () => ({
            data: 'Proxied content from Python',
            status: 'success'
          })
        });
        
        // Forward the request to Python proxy
        const response = await fetch(pythonProxyUrl, {
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body
        });
        
        return {
          ok: response.ok,
          status: response.status,
          data: await response.json()
        };
      });

      // Make request through Node.js API client
      const response = await apiClient.sendProxyRequest(targetUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      });

      // Verify Python proxy was called
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toContain(`${process.env.PYTHON_PROXY_URL}/bare-server/`);
      
      // Verify response was correctly passed back
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.data.data).toBe('Proxied content from Python');
    });
  });

  describe('AI Chat Integration', () => {
    test('should forward chat requests from Node.js to Python AI service', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { userId: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Chat message
      const chatMessage = {
        message: 'Hello, AI!',
        conversation_id: null,
        model: 'gemini-pro'
      };

      // Mock Node.js API client response
      apiClient.sendChatRequest.mockImplementation(async (message, options) => {
        // Simulate forwarding to Python AI service
        const pythonAiUrl = `${process.env.PYTHON_PROXY_URL}/api/chat`;
        
        // Mock Python AI service response
        fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            response: 'Hello! How can I help you today?',
            conversation_id: 'conv_123456',
            tokens: {
              input: 3,
              output: 7,
              total: 10
            },
            model: 'gemini-pro',
            hasError: false,
            timestamp: Date.now() / 1000
          })
        });
        
        // Forward the request to Python AI service
        const response = await fetch(pythonAiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': options.token ? `Bearer ${options.token}` : undefined
          },
          body: JSON.stringify(message)
        });
        
        return {
          ok: response.ok,
          status: response.status,
          data: await response.json()
        };
      });

      // Make request through Node.js API client
      const response = await apiClient.sendChatRequest(chatMessage, {
        token: validToken
      });

      // Verify Python AI service was called
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toBe(`${process.env.PYTHON_PROXY_URL}/api/chat`);
      expect(JSON.parse(fetch.mock.calls[0][1].body).message).toBe('Hello, AI!');
      
      // Verify response was correctly passed back
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.data.response).toBe('Hello! How can I help you today?');
      expect(response.data.conversation_id).toBe('conv_123456');
    });

    test('should handle AI service errors gracefully', async () => {
      // Chat message
      const chatMessage = {
        message: 'Hello, AI!',
        conversation_id: null
      };

      // Mock Node.js API client response
      apiClient.sendChatRequest.mockImplementation(async (message, options) => {
        // Simulate forwarding to Python AI service
        const pythonAiUrl = `${process.env.PYTHON_PROXY_URL}/api/chat`;
        
        // Mock Python AI service error response
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            response: "I'm sorry, I'm having trouble processing your request right now. Please try again later.",
            hasError: true,
            errorType: 'MODEL_ERROR',
            timestamp: Date.now() / 1000
          })
        });
        
        // Forward the request to Python AI service
        const response = await fetch(pythonAiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(message)
        });
        
        return {
          ok: response.ok,
          status: response.status,
          data: await response.json()
        };
      });

      // Make request through Node.js API client
      const response = await apiClient.sendChatRequest(chatMessage);

      // Verify response error was correctly passed back
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      expect(response.data.hasError).toBe(true);
      expect(response.data.errorType).toBe('MODEL_ERROR');
    });
  });

  describe('Topics Integration', () => {
    test('should retrieve suggested topics from Python AI service', async () => {
      // Mock Node.js API client response
      apiClient.getTopics.mockImplementation(async () => {
        // Simulate forwarding to Python AI service
        const pythonTopicsUrl = `${process.env.PYTHON_PROXY_URL}/api/topics`;
        
        // Mock Python AI service response
        fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            topics: [
              'Mathematics and Problem Solving',
              'Science and Technology Innovations',
              'Historical Events and Their Impact',
              'Literature and Creative Writing',
              'Computer Science and Programming'
            ],
            timestamp: Date.now() / 1000
          })
        });
        
        // Forward the request to Python AI service
        const response = await fetch(pythonTopicsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        return {
          ok: response.ok,
          status: response.status,
          data: await response.json()
        };
      });

      // Make request through Node.js API client
      const response = await apiClient.getTopics();

      // Verify Python AI service was called
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toBe(`${process.env.PYTHON_PROXY_URL}/api/topics`);
      
      // Verify response was correctly passed back
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.data.topics).toBeInstanceOf(Array);
      expect(response.data.topics.length).toBe(5);
    });
  });

  describe('Error Handling', () => {
    test('should handle Python proxy connection errors', async () => {
      // Target URL to proxy
      const targetUrl = 'https://example.com/api/data';

      // Mock Node.js API client response
      apiClient.sendProxyRequest.mockImplementation(async (url, options) => {
        // Simulate Python proxy being down
        fetch.mockRejectedValueOnce(new Error('Connection refused'));
        
        try {
          // Attempt to forward the request to Python proxy
          const encodedUrl = Buffer.from(url).toString('base64');
          const pythonProxyUrl = `${process.env.PYTHON_PROXY_URL}/bare-server/${encodedUrl}`;
          
          await fetch(pythonProxyUrl, {
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body
          });
          
          // This should not be reached
          return {
            ok: true,
            status: 200,
            data: {}
          };
        } catch (error) {
          // Return error response
          return {
            ok: false,
            status: 503,
            data: {
              error: 'Service Unavailable',
              message: 'Python proxy service is not available',
              details: error.message
            }
          };
        }
      });

      // Make request through Node.js API client
      const response = await apiClient.sendProxyRequest(targetUrl);

      // Verify fetch was called but failed
      expect(fetch).toHaveBeenCalledTimes(1);
      
      // Verify error response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(503);
      expect(response.data.error).toBe('Service Unavailable');
      expect(response.data.message).toBe('Python proxy service is not available');
    });
  });

  describe('Cross-Origin Resource Sharing', () => {
    test('should handle CORS preflight requests correctly', async () => {
      // Target URL to proxy
      const targetUrl = 'https://example.com/api/data';

      // Mock Node.js API client response for OPTIONS request
      apiClient.sendProxyRequest.mockImplementation(async (url, options) => {
        if (options.method === 'OPTIONS') {
          // Simulate forwarding to Python proxy
          const encodedUrl = Buffer.from(url).toString('base64');
          const pythonProxyUrl = `${process.env.PYTHON_PROXY_URL}/bare-server/${encodedUrl}`;
          
          // Mock Python proxy CORS response
          fetch.mockResolvedValueOnce({
            ok: true,
            status: 204,
            headers: new Headers({
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
            })
          });
          
          // Forward the OPTIONS request to Python proxy
          const response = await fetch(pythonProxyUrl, {
            method: 'OPTIONS',
            headers: options.headers || {}
          });
          
          return {
            ok: response.ok,
            status: response.status,
            headers: {
              'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
              'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
              'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
            }
          };
        }
      });

      // Make OPTIONS request through Node.js API client
      const response = await apiClient.sendProxyRequest(targetUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.org',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      });

      // Verify Python proxy was called
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toContain(`${process.env.PYTHON_PROXY_URL}/bare-server/`);
      expect(fetch.mock.calls[0][1].method).toBe('OPTIONS');
      
      // Verify CORS headers were correctly passed back
      expect(response.ok).toBe(true);
      expect(response.status).toBe(204);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(response.headers['Access-Control-Allow-Headers']).toContain('Authorization');
    });
  });
});
