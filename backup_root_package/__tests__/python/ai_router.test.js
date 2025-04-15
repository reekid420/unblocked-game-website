/**
 * Tests for Python proxy AI router functionality
 */

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock environment variables
process.env.GEMINI_API_KEY = 'test_gemini_api_key';
process.env.JWT_SECRET = 'test_jwt_secret';

// Import JWT for token generation
const jwt = require('jsonwebtoken');

describe('AI Router Functionality', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  describe('Chat Endpoint', () => {
    test('should process chat message and return response', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { sub: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          response: 'This is a test response from the AI',
          conversation_id: 'conv_123456',
          tokens: {
            input: 5,
            output: 8,
            total: 13
          },
          model: 'gemini-pro',
          hasError: false,
          timestamp: Date.now() / 1000
        })
      });

      // Make request with token
      const response = await fetch('http://localhost:6078/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        body: JSON.stringify({
          message: 'Hello, AI!',
          conversation_id: null,
          model: 'gemini-pro',
          temperature: 0.7
        })
      });

      // Verify request was made correctly
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toBe('http://localhost:6078/api/chat');
      expect(fetch.mock.calls[0][1].method).toBe('POST');
      expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${validToken}`);
      
      // Parse the request body to verify it
      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody.message).toBe('Hello, AI!');
      expect(requestBody.model).toBe('gemini-pro');
      
      // Verify response
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.response).toBe('This is a test response from the AI');
      expect(responseBody.conversation_id).toBe('conv_123456');
      expect(responseBody.hasError).toBe(false);
      expect(responseBody.tokens.total).toBe(13);
    });

    test('should handle rate limiting', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { sub: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Mock rate limit response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded',
          message: "I'm sorry, you've reached the limit of 10 messages per minute. Please try again in 30 seconds.",
          retryAfter: 30,
          request_id: 'req_123456'
        })
      });

      // Make request with token
      const response = await fetch('http://localhost:6078/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        body: JSON.stringify({
          message: 'Hello, AI!',
          conversation_id: null
        })
      });

      // Verify response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Rate limit exceeded');
      expect(responseBody.retryAfter).toBe(30);
    });

    test('should handle conversation continuity', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { sub: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Mock first response (new conversation)
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          response: 'Hello! How can I help you today?',
          conversation_id: 'conv_123456',
          tokens: {
            input: 5,
            output: 7,
            total: 12
          },
          model: 'gemini-pro',
          hasError: false,
          timestamp: Date.now() / 1000
        })
      });

      // First request - start conversation
      const firstResponse = await fetch('http://localhost:6078/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        body: JSON.stringify({
          message: 'Hello!',
          conversation_id: null
        })
      });

      const firstResponseBody = await firstResponse.json();
      const conversationId = firstResponseBody.conversation_id;
      
      // Mock second response (continuing conversation)
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          response: 'The capital of France is Paris.',
          conversation_id: conversationId,
          tokens: {
            input: 8,
            output: 6,
            total: 14
          },
          model: 'gemini-pro',
          hasError: false,
          timestamp: Date.now() / 1000
        })
      });

      // Second request - continue conversation
      const secondResponse = await fetch('http://localhost:6078/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        body: JSON.stringify({
          message: 'What is the capital of France?',
          conversation_id: conversationId
        })
      });

      // Verify second request was made with the conversation ID
      expect(fetch).toHaveBeenCalledTimes(2);
      const secondRequestBody = JSON.parse(fetch.mock.calls[1][1].body);
      expect(secondRequestBody.conversation_id).toBe(conversationId);
      
      // Verify second response
      expect(secondResponse.ok).toBe(true);
      
      const secondResponseBody = await secondResponse.json();
      expect(secondResponseBody.response).toBe('The capital of France is Paris.');
      expect(secondResponseBody.conversation_id).toBe(conversationId);
    });

    test('should handle AI model errors gracefully', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { sub: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Mock error response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          response: "I'm sorry, I'm having trouble processing your request right now. Please try again later.",
          conversation_id: null,
          tokens: {
            input: 5,
            output: 0,
            total: 5
          },
          model: 'gemini-pro',
          hasError: true,
          errorType: 'MODEL_ERROR',
          timestamp: Date.now() / 1000,
          request_id: 'req_123456'
        })
      });

      // Make request with token
      const response = await fetch('http://localhost:6078/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        body: JSON.stringify({
          message: 'Hello, AI!',
          conversation_id: null
        })
      });

      // Verify response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      
      const responseBody = await response.json();
      expect(responseBody.hasError).toBe(true);
      expect(responseBody.errorType).toBe('MODEL_ERROR');
    });
  });

  describe('Topics Endpoint', () => {
    test('should return suggested topics for anonymous users', async () => {
      // Mock successful response
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

      // Make request without authentication
      const response = await fetch('http://localhost:6078/api/topics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Verify response
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.topics).toBeInstanceOf(Array);
      expect(responseBody.topics.length).toBe(5);
    });

    test('should return personalized topics for authenticated users', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { sub: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Mock successful response with personalized topics
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          topics: [
            'Advanced Calculus Techniques',
            'Quantum Computing Principles',
            'Modern European History',
            'Shakespeare Analysis',
            'Machine Learning Algorithms'
          ],
          timestamp: Date.now() / 1000
        })
      });

      // Make request with authentication
      const response = await fetch('http://localhost:6078/api/topics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        }
      });

      // Verify request was made with correct headers
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${validToken}`);
      expect(response.ok).toBe(true);
      
      const responseBody = await response.json();
      expect(responseBody.topics).toBeInstanceOf(Array);
      expect(responseBody.topics.length).toBe(5);
      // The topics should be personalized
      expect(responseBody.topics[0]).toBe('Advanced Calculus Techniques');
    });
  });

  describe('Conversation Management', () => {
    test('should retrieve conversation history', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { sub: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const conversationId = 'conv_123456';

      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user_id: 'test_user',
          conversation_id: conversationId,
          created_at: Date.now() / 1000 - 3600, // 1 hour ago
          messages: [
            {
              role: 'user',
              content: 'Hello!',
              timestamp: Date.now() / 1000 - 3600
            },
            {
              role: 'assistant',
              content: 'Hi there! How can I help you today?',
              timestamp: Date.now() / 1000 - 3590
            },
            {
              role: 'user',
              content: 'What is the capital of France?',
              timestamp: Date.now() / 1000 - 3500
            },
            {
              role: 'assistant',
              content: 'The capital of France is Paris.',
              timestamp: Date.now() / 1000 - 3490
            }
          ]
        })
      });

      // Make request to get conversation history
      const response = await fetch(`http://localhost:6078/api/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      });

      // Verify request was made correctly
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toBe(`http://localhost:6078/api/conversations/${conversationId}`);
      expect(fetch.mock.calls[0][1].method).toBe('GET');
      
      // Verify response
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.user_id).toBe('test_user');
      expect(responseBody.conversation_id).toBe(conversationId);
      expect(responseBody.messages.length).toBe(4);
      expect(responseBody.messages[0].role).toBe('user');
      expect(responseBody.messages[0].content).toBe('Hello!');
    });

    test('should delete conversation history', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { sub: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const conversationId = 'conv_123456';

      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Conversation deleted successfully'
        })
      });

      // Make request to delete conversation
      const response = await fetch(`http://localhost:6078/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      });

      // Verify request was made correctly
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toBe(`http://localhost:6078/api/conversations/${conversationId}`);
      expect(fetch.mock.calls[0][1].method).toBe('DELETE');
      
      // Verify response
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.message).toBe('Conversation deleted successfully');
    });

    test('should prevent access to another user\'s conversation', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { sub: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const conversationId = 'conv_other_user';

      // Mock forbidden response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'Forbidden',
          message: 'You do not have access to this conversation'
        })
      });

      // Make request to get conversation history
      const response = await fetch(`http://localhost:6078/api/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      });

      // Verify response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Forbidden');
      expect(responseBody.message).toBe('You do not have access to this conversation');
    });
  });

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'healthy',
          timestamp: Date.now() / 1000,
          version: '1.0.0',
          gemini_available: true
        })
      });

      // Make request to health endpoint
      const response = await fetch('http://localhost:6078/api/health', {
        method: 'GET'
      });

      // Verify response
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.status).toBe('healthy');
      expect(responseBody.gemini_available).toBe(true);
    });
  });
});
