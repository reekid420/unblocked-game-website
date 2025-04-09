/**
 * Google Generative AI (Gemini) API integration
 */
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Store conversations in memory (in a real app, use a database)
const chatSessions = new Map();

// Session timeout in ms (1 hour)
const SESSION_TIMEOUT = 3600000;

// Rate limiting configuration
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute

// Error types for better fallback responses
const ERROR_TYPES = {
  RATE_LIMITED: 'RATE_LIMITED',
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  CONTENT_FILTERED: 'CONTENT_FILTERED',
  TOKEN_LIMIT: 'TOKEN_LIMIT',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Initialize the Google Generative AI client
 * @returns {GoogleGenerativeAI} Initialized Gemini client
 */
function initializeGemini() {
  // Ensure API key is available
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not found in environment variables');
    throw new Error('Missing Gemini API key');
  }
  
  // Initialize the Gemini API client
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/**
 * Check if a user has exceeded their rate limit
 * @param {string} userId - User ID to check
 * @returns {boolean} True if rate limited, false otherwise
 */
function isRateLimited(userId) {
  const now = Date.now();
  
  if (!rateLimits.has(userId)) {
    rateLimits.set(userId, {
      count: 1,
      windowStart: now
    });
    return false;
  }
  
  const userLimit = rateLimits.get(userId);
  
  // Reset window if it's expired
  if (now - userLimit.windowStart > RATE_LIMIT_WINDOW) {
    userLimit.count = 1;
    userLimit.windowStart = now;
    return false;
  }
  
  // Check if user has exceeded limit
  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  // Increment counter
  userLimit.count++;
  return false;
}

/**
 * Get a user-friendly error message based on error type
 * @param {string} errorType - Type of error from ERROR_TYPES
 * @returns {string} User-friendly error message
 */
function getFallbackResponse(errorType) {
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
}

/**
 * Determine the error type from an API error
 * @param {Error} error - The error object from the API call
 * @returns {string} Error type from ERROR_TYPES
 */
function determineErrorType(error) {
  const errorMsg = error.message ? error.message.toLowerCase() : '';
  const errorDetails = error.details ? JSON.stringify(error.details).toLowerCase() : '';
  
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
}

/**
 * Generate a chat response using the Gemini API
 * @param {string} userId - User ID for maintaining chat history
 * @param {string} message - User message
 * @returns {Promise<{text: string, error: boolean, errorType: string?}>} AI response object
 */
async function generateChatResponse(userId, message) {
  // Check rate limiting first
  if (isRateLimited(userId)) {
    console.log(`Rate limit exceeded for user: ${userId}`);
    return {
      text: getFallbackResponse(ERROR_TYPES.RATE_LIMITED),
      error: true,
      errorType: ERROR_TYPES.RATE_LIMITED
    };
  }

  try {
    // Get or create session
    if (!chatSessions.has(userId)) {
      chatSessions.set(userId, {
        history: [],
        lastAccess: Date.now()
      });
    }
    
    const session = chatSessions.get(userId);
    session.lastAccess = Date.now(); // Update last access time
    
    // Initialize the AI client
    const genAI = initializeGemini();
    // Updated to use the latest model version
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Add user message to history
    session.history.push({ role: 'user', parts: [{ text: message }] });
    
    // Start a chat with history
    const chat = model.startChat({
      history: session.history,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      ]
    });
    
    // Generate response with timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('API request timed out')), 15000);
    });
    
    const result = await Promise.race([
      chat.sendMessage(message),
      timeoutPromise
    ]);
    
    const response = result.response;
    const responseText = response.text();
    
    // Add AI response to history
    session.history.push({ role: 'model', parts: [{ text: responseText }] });
    
    // Limit history to 20 messages to prevent context overflow
    if (session.history.length > 20) {
      session.history = session.history.slice(session.history.length - 20);
    }
    
    return {
      text: responseText,
      error: false
    };
  } catch (error) {
    console.error('Error generating AI response:', error);
    
    // Determine the type of error and get appropriate fallback response
    const errorType = determineErrorType(error);
    const fallbackResponse = getFallbackResponse(errorType);
    
    // Log detailed error information for debugging
    console.error(`AI error type: ${errorType}`);
    console.error(`Error details: ${JSON.stringify(error.details || {})}`);
    
    return {
      text: fallbackResponse,
      error: true,
      errorType: errorType
    };
  }
}

/**
 * Clean up old chat sessions to free memory
 */
function cleanupOldSessions() {
  const now = Date.now();
  
  for (const [userId, session] of chatSessions.entries()) {
    if (now - session.lastAccess > SESSION_TIMEOUT) {
      console.log(`Cleaning up inactive session for user: ${userId}`);
      chatSessions.delete(userId);
    }
  }
}

/**
 * Clean up old rate limit entries
 */
function cleanupRateLimits() {
  const now = Date.now();
  
  for (const [userId, limit] of rateLimits.entries()) {
    if (now - limit.windowStart > RATE_LIMIT_WINDOW) {
      rateLimits.delete(userId);
    }
  }
}

// Set up regular cleanup intervals
setInterval(cleanupOldSessions, SESSION_TIMEOUT / 2);
setInterval(cleanupRateLimits, RATE_LIMIT_WINDOW);

module.exports = {
  generateChatResponse,
  cleanupOldSessions,
  ERROR_TYPES
}; 