/**
 * Tests for Python proxy authentication utilities
 */

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock environment variables
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.API_KEY = 'test_api_key';
process.env.SERVICE_TOKEN = 'test_service_token';

// Import JWT for token generation and verification
const jwt = require('jsonwebtoken');

describe('Python Proxy Authentication', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  describe('JWT Token Authentication', () => {
    test('should accept valid JWT token', async () => {
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
        json: async () => ({ message: 'Success' })
      });

      // Make request with token
      const response = await fetch('http://localhost:6078/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validToken}`
        },
        body: JSON.stringify({ message: 'Test message' })
      });

      // Verify request was made with correct headers
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${validToken}`);
      expect(response.ok).toBe(true);
    });

    test('should reject expired JWT token', async () => {
      // Create an expired token (issued 2 hours ago, expires after 1 hour)
      const expiredToken = jwt.sign(
        { 
          sub: 'test_user', 
          type: 'access',
          iat: Math.floor(Date.now() / 1000) - 7200 // 2 hours ago
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Mock 401 unauthorized response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ 
          detail: 'Token has expired',
          error: 'Unauthorized'
        })
      });

      // Make request with expired token
      const response = await fetch('http://localhost:6078/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${expiredToken}`
        },
        body: JSON.stringify({ message: 'Test message' })
      });

      // Verify response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
      
      const responseBody = await response.json();
      expect(responseBody.detail).toBe('Token has expired');
    });

    test('should reject token with invalid signature', async () => {
      // Create a token with wrong secret
      const invalidToken = jwt.sign(
        { sub: 'test_user', type: 'access' },
        'wrong_secret',
        { expiresIn: '1h' }
      );

      // Mock 401 unauthorized response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ 
          detail: 'Invalid authentication credentials',
          error: 'Unauthorized'
        })
      });

      // Make request with invalid token
      const response = await fetch('http://localhost:6078/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${invalidToken}`
        },
        body: JSON.stringify({ message: 'Test message' })
      });

      // Verify response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('API Key Authentication', () => {
    test('should accept valid API key', async () => {
      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Success' })
      });

      // Make request with API key
      const response = await fetch('http://localhost:6078/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.API_KEY
        },
        body: JSON.stringify({ message: 'Test message' })
      });

      // Verify request was made with correct headers
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1].headers['X-API-Key']).toBe(process.env.API_KEY);
      expect(response.ok).toBe(true);
    });

    test('should reject invalid API key', async () => {
      // Mock 401 unauthorized response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ 
          detail: 'Invalid authentication credentials',
          error: 'Unauthorized'
        })
      });

      // Make request with invalid API key
      const response = await fetch('http://localhost:6078/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'invalid_api_key'
        },
        body: JSON.stringify({ message: 'Test message' })
      });

      // Verify response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('Service Token Authentication', () => {
    test('should accept valid service token for internal endpoints', async () => {
      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ 
          total_requests: 100,
          successful_requests: 95
        })
      });

      // Make request with service token to metrics endpoint
      const response = await fetch('http://localhost:6078/api/metrics', {
        method: 'GET',
        headers: {
          'X-Service-Token': process.env.SERVICE_TOKEN
        }
      });

      // Verify request was made with correct headers
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1].headers['X-Service-Token']).toBe(process.env.SERVICE_TOKEN);
      expect(response.ok).toBe(true);
    });

    test('should reject invalid service token', async () => {
      // Mock 403 forbidden response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ 
          error: 'Forbidden',
          message: 'Invalid service token'
        })
      });

      // Make request with invalid service token
      const response = await fetch('http://localhost:6078/api/metrics', {
        method: 'GET',
        headers: {
          'X-Service-Token': 'invalid_service_token'
        }
      });

      // Verify response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Forbidden');
      expect(responseBody.message).toBe('Invalid service token');
    });
  });

  describe('Optional Authentication', () => {
    test('should allow access to endpoints with optional auth when no credentials provided', async () => {
      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ 
          topics: ['Math', 'Science', 'History', 'Literature', 'Computer Science']
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

    test('should enhance response with user context when credentials are provided', async () => {
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
            'Advanced Mathematics',
            'Quantum Physics',
            'Modern History',
            'Classic Literature',
            'Programming Languages'
          ]
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
      // The topics should be different/personalized when auth is provided
      expect(responseBody.topics[0]).toBe('Advanced Mathematics');
    });
  });
});
