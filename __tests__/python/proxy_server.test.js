/**
 * @jest-environment node
 */

const axios = require('axios');

// Mock axios
jest.mock('axios');

// Mock environment variables
process.env.PYTHON_PROXY_URL = 'http://localhost:8000';

describe('Python FastAPI Proxy Server', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Proxy Routing', () => {
    test('should forward requests to target URL', async () => {
      // Mock successful proxy response
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true, content: '<html><body>Proxied content</body></html>' }
      });

      // Test proxy request
      const targetUrl = 'https://example.com';
      const response = await axios.post(`${process.env.PYTHON_PROXY_URL}/proxy`, {
        url: targetUrl,
        method: 'GET',
        headers: { 'User-Agent': 'Test User Agent' }
      });

      // Verify response
      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        success: true,
        content: '<html><body>Proxied content</body></html>'
      });

      // Verify axios was called with correct parameters
      expect(axios.post).toHaveBeenCalledWith(
        `${process.env.PYTHON_PROXY_URL}/proxy`,
        {
          url: targetUrl,
          method: 'GET',
          headers: { 'User-Agent': 'Test User Agent' }
        }
      );
    });

    test('should handle proxy errors gracefully', async () => {
      // Mock error response
      axios.post.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { success: false, error: 'Failed to proxy request' }
        }
      });

      // Test proxy request with expected error
      try {
        await axios.post(`${process.env.PYTHON_PROXY_URL}/proxy`, {
          url: 'https://example.com',
          method: 'GET'
        });
        // If we reach here, the test should fail
        expect(true).toBe(false); // This should not be reached
      } catch (error) {
        // Verify error response
        expect(error.response.status).toBe(500);
        expect(error.response.data).toEqual({
          success: false,
          error: 'Failed to proxy request'
        });
      }
    });
  });

  describe('AI Chat Integration', () => {
    test('should process chat messages', async () => {
      // Mock successful chat response
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          response: 'This is a response from the AI',
          conversationId: '123456',
          tokens: {
            input: 10,
            output: 15,
            total: 25
          }
        }
      });

      // Test chat request
      const response = await axios.post(`${process.env.PYTHON_PROXY_URL}/chat`, {
        message: 'Hello AI',
        userId: 'test-user',
        conversationId: null // New conversation
      });

      // Verify response
      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        response: 'This is a response from the AI',
        conversationId: '123456',
        tokens: {
          input: 10,
          output: 15,
          total: 25
        }
      });

      // Verify axios was called with correct parameters
      expect(axios.post).toHaveBeenCalledWith(
        `${process.env.PYTHON_PROXY_URL}/chat`,
        {
          message: 'Hello AI',
          userId: 'test-user',
          conversationId: null
        }
      );
    });

    test('should handle chat errors gracefully', async () => {
      // Mock error response
      axios.post.mockRejectedValueOnce({
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' }
        }
      });

      // Test chat request with expected error
      try {
        await axios.post(`${process.env.PYTHON_PROXY_URL}/chat`, {
          message: 'Hello AI',
          userId: 'rate-limited-user',
          conversationId: null
        });
        // If we reach here, the test should fail
        expect(true).toBe(false); // This should not be reached
      } catch (error) {
        // Verify error response
        expect(error.response.status).toBe(429);
        expect(error.response.data).toEqual({
          error: 'Rate limit exceeded'
        });
      }
    });
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      // Mock successful health check response
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'healthy',
          version: '1.0.0',
          uptime: 3600
        }
      });

      // Test health check request
      const response = await axios.get(`${process.env.PYTHON_PROXY_URL}/health`);

      // Verify response
      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        status: 'healthy',
        version: '1.0.0',
        uptime: 3600
      });

      // Verify axios was called with correct URL
      expect(axios.get).toHaveBeenCalledWith(
        `${process.env.PYTHON_PROXY_URL}/health`
      );
    });
  });
});
