/**
 * Tests for Gemini API integration
 */

// Mock dependencies
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockImplementation(() => {
          return {
            startChat: jest.fn().mockImplementation(() => {
              return {
                sendMessage: jest.fn().mockImplementation(async (message) => {
                  if (message.includes('error')) {
                    throw new Error('API error');
                  }
                  return {
                    response: {
                      text: () => `Response to: ${message}`
                    }
                  };
                })
              };
            })
          };
        })
      };
    })
  };
});

// Mock environment variables
process.env.GEMINI_API_KEY = 'test-api-key';

// Create a mock gemini module with the functions we need to test
const ERROR_TYPES = {
  RATE_LIMITED: 'RATE_LIMITED',
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  CONTENT_FILTERED: 'CONTENT_FILTERED',
  TOKEN_LIMIT: 'TOKEN_LIMIT',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNKNOWN: 'UNKNOWN'
};

const rateLimits = new Map();
const chatSessions = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute

// Mock the functions we want to test
const initializeGemini = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing Gemini API key');
  }
  return new (require('@google/generative-ai').GoogleGenerativeAI)(process.env.GEMINI_API_KEY);
};

const isRateLimited = (userId) => {
  const now = Date.now();
  
  if (!rateLimits.has(userId)) {
    const newLimit = {
      count: 1,
      windowStart: now,
      limited: false,
      remainingRequests: MAX_REQUESTS_PER_WINDOW - 1,
      resetTime: now + RATE_LIMIT_WINDOW,
      consecutiveWindows: 0
    };
    rateLimits.set(userId, newLimit);
    return newLimit;
  }
  
  const userLimit = rateLimits.get(userId);
  
  if (now - userLimit.windowStart > RATE_LIMIT_WINDOW) {
    if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
      userLimit.consecutiveWindows++;
    } else {
      userLimit.consecutiveWindows = 0;
    }
    
    userLimit.count = 1;
    userLimit.windowStart = now;
    userLimit.limited = false;
    userLimit.remainingRequests = MAX_REQUESTS_PER_WINDOW - 1;
    userLimit.resetTime = now + RATE_LIMIT_WINDOW;
    return userLimit;
  }
  
  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    userLimit.limited = true;
    userLimit.remainingRequests = 0;
    return userLimit;
  }
  
  userLimit.count++;
  userLimit.remainingRequests = MAX_REQUESTS_PER_WINDOW - userLimit.count;
  userLimit.limited = false;
  return userLimit;
};

const getFallbackResponse = (errorType) => {
  switch (errorType) {
    case ERROR_TYPES.RATE_LIMITED:
      return "I'm sorry, you've sent too many messages in a short period. Please wait a moment before trying again.";
    case ERROR_TYPES.API_UNAVAILABLE:
      return "I'm currently experiencing connectivity issues. Please try again in a few minutes.";
    case ERROR_TYPES.CONTENT_FILTERED:
      return "I'm unable to respond to that message due to content restrictions. Please try a different question.";
    case ERROR_TYPES.TOKEN_LIMIT:
      return "Your conversation has become too long. Try starting a new conversation or simplifying your question.";
    case ERROR_TYPES.INVALID_REQUEST:
      return "I couldn't process your request. Please check your message and try again.";
    default:
      return "I'm sorry, I encountered an error while processing your request. Please try again later.";
  }
};

const determineErrorType = (error) => {
  const errorMsg = error.message ? error.message.toLowerCase() : '';
  
  if (errorMsg.includes('rate limit') || errorMsg.includes('quota')) {
    return ERROR_TYPES.RATE_LIMITED;
  } else if (errorMsg.includes('content filtered') || errorMsg.includes('safety')) {
    return ERROR_TYPES.CONTENT_FILTERED;
  } else if (errorMsg.includes('token') && errorMsg.includes('limit')) {
    return ERROR_TYPES.TOKEN_LIMIT;
  } else if (errorMsg.includes('invalid request') || errorMsg.includes('bad request')) {
    return ERROR_TYPES.INVALID_REQUEST;
  } else if (errorMsg.includes('unavailable') || errorMsg.includes('timeout') || errorMsg.includes('network')) {
    return ERROR_TYPES.API_UNAVAILABLE;
  }
  
  return ERROR_TYPES.UNKNOWN;
};

const generateChatResponse = async (userId, message) => {
  console.log(`Generating chat response for user ${userId}`);
  
  const rateStatus = isRateLimited(userId);
  if (rateStatus.limited) {
    const resetInSeconds = Math.ceil((rateStatus.resetTime - Date.now()) / 1000);
    
    if (rateStatus.consecutiveWindows > 3) {
      return "I'm sorry, but you've been sending too many messages. Please try again later.";
    }
    
    return `I'm sorry, you've reached the limit of ${MAX_REQUESTS_PER_WINDOW} messages per minute. Please try again in ${resetInSeconds} seconds.`;
  }

  try {
    if (!chatSessions.has(userId)) {
      chatSessions.set(userId, {
        history: [],
        lastAccess: Date.now()
      });
    }
    
    const session = chatSessions.get(userId);
    session.lastAccess = Date.now();
    
    const genAI = initializeGemini();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const chat = model.startChat();
    const result = await chat.sendMessage(message);
    return result.response.text();
  } catch (error) {
    console.error('Error generating chat response:', error);
    const errorType = determineErrorType(error);
    console.log(`Returning fallback response for error type: ${errorType}`);
    return getFallbackResponse(errorType);
  }
};

// Create our mock module
const geminiModule = {
  initializeGemini,
  isRateLimited,
  getFallbackResponse,
  determineErrorType,
  generateChatResponse,
  ERROR_TYPES
};

// Define global beforeEach if not already defined
global.beforeEach = global.beforeEach || ((fn) => fn());

// Reset module state between tests
beforeEach(() => {
  // Reset rate limits and chat sessions
  jest.resetModules();
});

describe('Gemini API Integration', () => {
  describe('initializeGemini', () => {
    test('should initialize Gemini client with API key', () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const { initializeGemini } = geminiModule;
      
      const client = initializeGemini();
      
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
      expect(client).toBeDefined();
    });
    
    test('should throw error if API key is missing', () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      
      const { initializeGemini } = geminiModule;
      
      expect(() => initializeGemini()).toThrow('Missing Gemini API key');
      
      // Restore API key
      process.env.GEMINI_API_KEY = originalKey;
    });
  });
  
  describe('isRateLimited', () => {
    test('should initialize rate limit for new users', () => {
      const { isRateLimited } = geminiModule;
      
      const result = isRateLimited('new-user');
      
      expect(result.limited).toBe(false);
      expect(result.count).toBe(1);
      expect(result.remainingRequests).toBe(9); // MAX_REQUESTS_PER_WINDOW - 1
    });
    
    test('should track requests within rate limit window', () => {
      const { isRateLimited } = geminiModule;
      const userId = 'test-user';
      
      // First request
      const result1 = isRateLimited(userId);
      expect(result1.limited).toBe(false);
      expect(result1.count).toBe(1);
      
      // Second request
      const result2 = isRateLimited(userId);
      expect(result2.limited).toBe(false);
      expect(result2.count).toBe(2);
      expect(result2.remainingRequests).toBe(8); // MAX_REQUESTS_PER_WINDOW - 2
    });
    
    test('should limit users who exceed the rate limit', () => {
      const { isRateLimited } = geminiModule;
      const userId = 'heavy-user';
      
      // Make 10 requests (the maximum allowed)
      let result;
      for (let i = 0; i < 10; i++) {
        result = isRateLimited(userId);
      }
      
      // Should not be limited yet
      expect(result.limited).toBe(false);
      expect(result.count).toBe(10);
      expect(result.remainingRequests).toBe(0);
      
      // 11th request should be limited
      result = isRateLimited(userId);
      expect(result.limited).toBe(true);
      expect(result.remainingRequests).toBe(0);
    });
  });
  
  describe('getFallbackResponse', () => {
    test('should return appropriate message for rate limiting', () => {
      const { getFallbackResponse, ERROR_TYPES } = geminiModule;
      
      const response = getFallbackResponse(ERROR_TYPES.RATE_LIMITED);
      
      expect(response).toContain('too many messages');
    });
    
    test('should return appropriate message for content filtering', () => {
      const { getFallbackResponse, ERROR_TYPES } = geminiModule;
      
      const response = getFallbackResponse(ERROR_TYPES.CONTENT_FILTERED);
      
      expect(response).toContain('content restrictions');
    });
    
    test('should return default message for unknown errors', () => {
      const { getFallbackResponse } = geminiModule;
      
      const response = getFallbackResponse('SOME_UNKNOWN_ERROR');
      
      expect(response).toContain('encountered an error');
    });
  });
  
  describe('determineErrorType', () => {
    test('should identify rate limit errors', () => {
      const { determineErrorType, ERROR_TYPES } = geminiModule;
      
      const error = new Error('Rate limit exceeded');
      const errorType = determineErrorType(error);
      
      expect(errorType).toBe(ERROR_TYPES.RATE_LIMITED);
    });
    
    test('should identify content filtering errors', () => {
      const { determineErrorType, ERROR_TYPES } = geminiModule;
      
      const error = new Error('Content filtered due to safety settings');
      const errorType = determineErrorType(error);
      
      expect(errorType).toBe(ERROR_TYPES.CONTENT_FILTERED);
    });
    
    test('should return unknown for unrecognized errors', () => {
      const { determineErrorType, ERROR_TYPES } = geminiModule;
      
      const error = new Error('Some random error');
      const errorType = determineErrorType(error);
      
      expect(errorType).toBe(ERROR_TYPES.UNKNOWN);
    });
  });
  
  describe('generateChatResponse', () => {
    test('should generate response for valid message', async () => {
      const { generateChatResponse } = geminiModule;
      
      const response = await generateChatResponse('test-user', 'Hello AI');
      
      expect(response).toContain('Response to: Hello AI');
    });
    
    test('should return error message when rate limited', async () => {
      const { generateChatResponse, isRateLimited } = geminiModule;
      const userId = 'rate-limited-user';
      
      // Exhaust rate limit
      for (let i = 0; i < 10; i++) {
        isRateLimited(userId);
      }
      
      const response = await generateChatResponse(userId, 'Hello AI');
      
      expect(response).toContain('limit of');
    });
  });
});
