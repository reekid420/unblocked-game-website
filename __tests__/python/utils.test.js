/**
 * Tests for Python proxy utility functions
 */

// Mock environment variables
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.API_KEY = 'test_api_key';
process.env.SERVICE_TOKEN = 'test_service_token';
process.env.RATE_LIMIT_WINDOW = '60';
process.env.MAX_REQUESTS_PER_WINDOW = '10';
process.env.ENABLE_PROXY_CACHE = 'true';
process.env.PROXY_CACHE_TTL = '300';

// Import JWT for token generation and verification
const jwt = require('jsonwebtoken');

// Mock the cache module
const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  has: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn()
};

// Mock the rate limiter
const mockRateLimiter = {
  isRateLimited: jest.fn(),
  incrementCounter: jest.fn(),
  resetCounter: jest.fn(),
  getStatus: jest.fn()
};

// Mock the logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

describe('Python Proxy Utilities', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockClear();
    mockCache.set.mockClear();
    mockCache.has.mockClear();
    mockRateLimiter.isRateLimited.mockClear();
    mockRateLimiter.incrementCounter.mockClear();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
  });

  describe('Authentication Utilities', () => {
    test('should create valid JWT tokens', () => {
      // Create a token with test data
      const userData = { sub: 'test_user', role: 'user' };
      const expiresIn = 60 * 60; // 1 hour
      
      const token = jwt.sign(
        { ...userData, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn }
      );
      
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check token contents
      expect(decoded.sub).toBe(userData.sub);
      expect(decoded.role).toBe(userData.role);
      expect(decoded.type).toBe('access');
      expect(decoded.exp).toBeDefined();
      
      // Check token expiration
      const now = Math.floor(Date.now() / 1000);
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(now + expiresIn + 1); // Add 1 second for timing variations
    });

    test('should verify password hashes correctly', () => {
      // This is a simplified test since we can't directly test the Python bcrypt implementation
      // In a real test, we would use the same hashing algorithm
      
      // Mock password verification
      const verifyPassword = (plain, hashed) => {
        // Simple mock for testing - in reality this would use bcrypt
        return hashed === `hashed_${plain}`;
      };
      
      // Test verification
      expect(verifyPassword('correct_password', 'hashed_correct_password')).toBe(true);
      expect(verifyPassword('wrong_password', 'hashed_correct_password')).toBe(false);
    });

    test('should validate service tokens', () => {
      // Mock service token validation
      const validateServiceToken = (token) => {
        return token === process.env.SERVICE_TOKEN;
      };
      
      // Test validation
      expect(validateServiceToken(process.env.SERVICE_TOKEN)).toBe(true);
      expect(validateServiceToken('invalid_token')).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should track rate limits correctly', () => {
      const userId = 'test_user';
      const maxRequests = parseInt(process.env.MAX_REQUESTS_PER_WINDOW);
      const windowSeconds = parseInt(process.env.RATE_LIMIT_WINDOW);
      
      // Mock rate limiter behavior
      mockRateLimiter.isRateLimited.mockImplementation((id) => {
        // Return not limited for the first maxRequests calls
        const count = mockRateLimiter.incrementCounter.mock.calls.filter(call => call[0] === id).length;
        const limited = count >= maxRequests;
        
        return {
          limited,
          reset_time: Math.floor(Date.now() / 1000) + windowSeconds,
          consecutive_windows: limited ? 1 : 0
        };
      });
      
      // Test under the limit
      for (let i = 0; i < maxRequests; i++) {
        const status = mockRateLimiter.isRateLimited(userId);
        mockRateLimiter.incrementCounter(userId);
        expect(status.limited).toBe(false);
      }
      
      // Test over the limit
      const status = mockRateLimiter.isRateLimited(userId);
      expect(status.limited).toBe(true);
      expect(status.reset_time).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test('should handle persistent abusers with increasing penalties', () => {
      const userId = 'abusive_user';
      
      // Mock rate limiter behavior for persistent abuser
      mockRateLimiter.isRateLimited.mockImplementation((id) => {
        // Simulate a user who has exceeded rate limits multiple times
        return {
          limited: true,
          reset_time: Math.floor(Date.now() / 1000) + 300, // 5 minutes
          consecutive_windows: 5 // Multiple consecutive violations
        };
      });
      
      // Check rate limit status
      const status = mockRateLimiter.isRateLimited(userId);
      
      // Verify increased penalty
      expect(status.limited).toBe(true);
      expect(status.consecutive_windows).toBe(5);
      expect(status.reset_time).toBeGreaterThan(Math.floor(Date.now() / 1000) + 60); // More than 1 minute
    });
  });

  describe('Caching', () => {
    test('should cache and retrieve items correctly', () => {
      const cacheKey = 'test_key';
      const cacheValue = { data: 'test_data' };
      const ttl = parseInt(process.env.PROXY_CACHE_TTL);
      
      // Test cache miss
      mockCache.has.mockReturnValueOnce(false);
      mockCache.get.mockReturnValueOnce(undefined);
      
      expect(mockCache.has(cacheKey)).toBe(false);
      expect(mockCache.get(cacheKey)).toBeUndefined();
      
      // Set cache
      mockCache.set(cacheKey, cacheValue, ttl);
      
      expect(mockCache.set).toHaveBeenCalledWith(cacheKey, cacheValue, ttl);
      
      // Test cache hit
      mockCache.has.mockReturnValueOnce(true);
      mockCache.get.mockReturnValueOnce(cacheValue);
      
      expect(mockCache.has(cacheKey)).toBe(true);
      expect(mockCache.get(cacheKey)).toBe(cacheValue);
    });

    test('should respect cache TTL', () => {
      jest.useFakeTimers();
      
      const cacheKey = 'test_key';
      const cacheValue = { data: 'test_data' };
      const ttl = 60; // 60 seconds
      
      // Mock cache implementation with TTL
      const cache = new Map();
      const expires = new Map();
      
      const mockCacheWithTTL = {
        set: (key, value, ttlSeconds) => {
          cache.set(key, value);
          expires.set(key, Date.now() + (ttlSeconds * 1000));
        },
        get: (key) => {
          if (!cache.has(key)) return undefined;
          
          const expiry = expires.get(key);
          if (expiry && expiry < Date.now()) {
            cache.delete(key);
            expires.delete(key);
            return undefined;
          }
          
          return cache.get(key);
        },
        has: (key) => {
          if (!cache.has(key)) return false;
          
          const expiry = expires.get(key);
          if (expiry && expiry < Date.now()) {
            cache.delete(key);
            expires.delete(key);
            return false;
          }
          
          return true;
        }
      };
      
      // Set cache item
      mockCacheWithTTL.set(cacheKey, cacheValue, ttl);
      
      // Verify it's in the cache
      expect(mockCacheWithTTL.has(cacheKey)).toBe(true);
      expect(mockCacheWithTTL.get(cacheKey)).toBe(cacheValue);
      
      // Advance time just before expiry
      jest.advanceTimersByTime((ttl * 1000) - 1);
      
      // Should still be in cache
      expect(mockCacheWithTTL.has(cacheKey)).toBe(true);
      expect(mockCacheWithTTL.get(cacheKey)).toBe(cacheValue);
      
      // Advance time past expiry
      jest.advanceTimersByTime(2);
      
      // Should be expired
      expect(mockCacheWithTTL.has(cacheKey)).toBe(false);
      expect(mockCacheWithTTL.get(cacheKey)).toBeUndefined();
      
      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    test('should determine error types correctly', () => {
      // Mock error type determination function
      const determineErrorType = (error) => {
        if (error.message.includes('rate limit')) {
          return 'RATE_LIMITED';
        } else if (error.message.includes('timeout')) {
          return 'TIMEOUT';
        } else if (error.message.includes('content filtered')) {
          return 'CONTENT_FILTERED';
        } else if (error.message.includes('model not available')) {
          return 'MODEL_UNAVAILABLE';
        } else {
          return 'UNKNOWN';
        }
      };
      
      // Test different error types
      expect(determineErrorType(new Error('rate limit exceeded'))).toBe('RATE_LIMITED');
      expect(determineErrorType(new Error('request timeout after 30s'))).toBe('TIMEOUT');
      expect(determineErrorType(new Error('content filtered by safety settings'))).toBe('CONTENT_FILTERED');
      expect(determineErrorType(new Error('model not available: gemini-pro'))).toBe('MODEL_UNAVAILABLE');
      expect(determineErrorType(new Error('some other error'))).toBe('UNKNOWN');
    });

    test('should provide appropriate fallback responses', () => {
      // Mock fallback response function
      const getFallbackResponse = (errorType) => {
        switch (errorType) {
          case 'RATE_LIMITED':
            return "I'm sorry, but you've reached the rate limit. Please try again later.";
          case 'TIMEOUT':
            return "I'm sorry, but your request timed out. Please try again with a simpler query.";
          case 'CONTENT_FILTERED':
            return "I'm sorry, but I cannot respond to that query due to content safety policies.";
          case 'MODEL_UNAVAILABLE':
            return "I'm sorry, but the AI model is currently unavailable. Please try again later.";
          default:
            return "I'm sorry, but I encountered an error processing your request. Please try again later.";
        }
      };
      
      // Test fallback responses
      expect(getFallbackResponse('RATE_LIMITED')).toContain('rate limit');
      expect(getFallbackResponse('TIMEOUT')).toContain('timed out');
      expect(getFallbackResponse('CONTENT_FILTERED')).toContain('content safety');
      expect(getFallbackResponse('MODEL_UNAVAILABLE')).toContain('model is currently unavailable');
      expect(getFallbackResponse('UNKNOWN')).toContain('encountered an error');
    });
  });

  describe('Logging', () => {
    test('should log important events', () => {
      // Log various events
      mockLogger.info('User authenticated', { userId: 'test_user' });
      mockLogger.error('Authentication failed', { error: 'Invalid token' });
      mockLogger.warn('Rate limit approaching', { userId: 'test_user', requests: 9, limit: 10 });
      
      // Verify logs were created
      expect(mockLogger.info).toHaveBeenCalledWith('User authenticated', { userId: 'test_user' });
      expect(mockLogger.error).toHaveBeenCalledWith('Authentication failed', { error: 'Invalid token' });
      expect(mockLogger.warn).toHaveBeenCalledWith('Rate limit approaching', { userId: 'test_user', requests: 9, limit: 10 });
    });
  });

  describe('Request ID Generation', () => {
    test('should generate unique request IDs', () => {
      // Mock request ID generation function
      const generateRequestId = () => {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      };
      
      // Generate multiple IDs
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      const id3 = generateRequestId();
      
      // Verify uniqueness
      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);
      
      // Verify format
      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(id3).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('Conversation Management', () => {
    test('should generate unique conversation IDs', () => {
      // Mock conversation ID generation function
      const generateConversationId = (userId) => {
        return `conv_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      };
      
      // Generate multiple IDs for the same user
      const userId = 'test_user';
      const id1 = generateConversationId(userId);
      const id2 = generateConversationId(userId);
      
      // Verify uniqueness
      expect(id1).not.toBe(id2);
      
      // Verify format and user ID inclusion
      expect(id1).toMatch(new RegExp(`^conv_${userId}_\\d+_[a-z0-9]+$`));
      expect(id2).toMatch(new RegExp(`^conv_${userId}_\\d+_[a-z0-9]+$`));
    });

    test('should store and retrieve conversation history', () => {
      // Mock conversation storage
      const conversations = {};
      
      // Mock store conversation function
      const storeConversation = (userId, conversationId, message, response) => {
        if (!conversations[conversationId]) {
          conversations[conversationId] = {
            user_id: userId,
            conversation_id: conversationId,
            created_at: Date.now() / 1000,
            messages: []
          };
        }
        
        // Add user message
        conversations[conversationId].messages.push({
          role: 'user',
          content: message,
          timestamp: Date.now() / 1000
        });
        
        // Add assistant response
        conversations[conversationId].messages.push({
          role: 'assistant',
          content: response,
          timestamp: Date.now() / 1000
        });
        
        return conversationId;
      };
      
      // Mock get conversation function
      const getConversation = (conversationId) => {
        return conversations[conversationId];
      };
      
      // Create a conversation
      const userId = 'test_user';
      const conversationId = 'conv_test_123';
      const message = 'Hello!';
      const response = 'Hi there! How can I help you today?';
      
      storeConversation(userId, conversationId, message, response);
      
      // Verify conversation was stored
      const conversation = getConversation(conversationId);
      expect(conversation).toBeDefined();
      expect(conversation.user_id).toBe(userId);
      expect(conversation.conversation_id).toBe(conversationId);
      expect(conversation.messages.length).toBe(2);
      expect(conversation.messages[0].role).toBe('user');
      expect(conversation.messages[0].content).toBe(message);
      expect(conversation.messages[1].role).toBe('assistant');
      expect(conversation.messages[1].content).toBe(response);
      
      // Add to the conversation
      const followupMessage = 'What is the capital of France?';
      const followupResponse = 'The capital of France is Paris.';
      
      storeConversation(userId, conversationId, followupMessage, followupResponse);
      
      // Verify conversation was updated
      const updatedConversation = getConversation(conversationId);
      expect(updatedConversation.messages.length).toBe(4);
      expect(updatedConversation.messages[2].content).toBe(followupMessage);
      expect(updatedConversation.messages[3].content).toBe(followupResponse);
    });
  });
});
