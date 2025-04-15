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
 * Check if a user has exceeded their rate limit with enhanced tracking
 * @param {string} userId - User ID to check
 * @returns {object} Rate limit status with more details
 */
function isRateLimited(userId) {
  const now = Date.now();
  
  // Initialize rate limiting for new users
  if (!rateLimits.has(userId)) {
    const newLimit = {
      count: 1,
      windowStart: now,
      limited: false,
      remainingRequests: MAX_REQUESTS_PER_WINDOW - 1,
      resetTime: now + RATE_LIMIT_WINDOW,
      consecutiveWindows: 0 // Track abuse patterns
    };
    rateLimits.set(userId, newLimit);
    return newLimit;
  }
  
  const userLimit = rateLimits.get(userId);
  
  // Reset window if it's expired
  if (now - userLimit.windowStart > RATE_LIMIT_WINDOW) {
    // Check if this is consecutive rate limiting
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
  
  // Check if user has exceeded limit
  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    userLimit.limited = true;
    userLimit.remainingRequests = 0;
    return userLimit;
  }
  
  // Increment counter and update remaining
  userLimit.count++;
  userLimit.remainingRequests = MAX_REQUESTS_PER_WINDOW - userLimit.count;
  userLimit.limited = false;
  return userLimit;
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
 * @returns {Promise<string>} AI response text
 */
async function generateChatResponse(userId, message) {
  console.log(`Generating chat response for user ${userId}`);
  
  // Check rate limiting first with enhanced tracking
  const rateStatus = isRateLimited(userId);
  if (rateStatus.limited) {
    console.log(`Rate limit exceeded for user: ${userId}, consecutive windows: ${rateStatus.consecutiveWindows}`);
    // Provide more specific information to the user
    const resetInSeconds = Math.ceil((rateStatus.resetTime - Date.now()) / 1000);
    
    // Different message for persistent abusers
    if (rateStatus.consecutiveWindows > 3) {
      return "I'm sorry, but you've been sending too many messages. Please try again later.";
    }
    
    return `I'm sorry, you've reached the limit of ${MAX_REQUESTS_PER_WINDOW} messages per minute. Please try again in ${resetInSeconds} seconds.`;
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
    
    try {
      // Use the latest model version with fallback options
      // Updated to the most current model name as of April 2025
      let modelName = 'gemini-1.5-pro';
      console.log(`Attempting to use primary Gemini model: ${modelName}`);
      
      // Model initialization with fallback strategy
      let model;
      try {
        model = genAI.getGenerativeModel({ model: modelName });
      } catch (modelInitError) {
        // First fallback: Try flash model if pro is unavailable
        console.warn(`Failed to initialize ${modelName}, falling back to gemini-1.5-flash`);
        modelName = 'gemini-1.5-flash';
        try {
          model = genAI.getGenerativeModel({ model: modelName });
        } catch (fallback1Error) {
          // Second fallback: Try stable version if needed
          console.warn(`Failed to initialize ${modelName}, falling back to gemini-pro`);
          modelName = 'gemini-pro';
          model = genAI.getGenerativeModel({ model: modelName });
        }
      }
      
      console.log(`Successfully initialized Gemini model: ${modelName}`);
      
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
      
      // Enhanced response generation with better timeout handling and retry logic
      // Increased timeout to 15 seconds for more reliable responses
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API request timed out')), 15000);
      });
      
      // Add retry capability for transient errors
      let result;
      let retryCount = 0;
      const MAX_RETRIES = 2;
      
      while (retryCount <= MAX_RETRIES) {
        try {
          console.log(`Sending message to Gemini API (attempt ${retryCount + 1})...`);
          result = await Promise.race([
            chat.sendMessage(message),
            timeoutPromise
          ]);
          // Success, exit retry loop
          break;
        } catch (apiError) {
          // Only retry on transient errors like timeouts or network issues
          if (retryCount < MAX_RETRIES && 
              (apiError.message.includes('timeout') || 
               apiError.message.includes('network') ||
               apiError.message.includes('unavailable'))) {
            console.warn(`Retrying due to transient error: ${apiError.message}`);
            retryCount++;
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          } else {
            // Non-retryable error or max retries reached
            throw apiError;
          }
        }
      }
      
      console.log('Received response from Gemini API');
      const response = result.response;
      const responseText = response.text();
      
      // Add AI response to history
      session.history.push({ role: 'model', parts: [{ text: responseText }] });
      
      // Keep history within reasonable limits (last 20 messages)
      if (session.history.length > 20) {
        session.history = session.history.slice(-20);
      }
      
      console.log(`Successfully generated response: ${responseText.substring(0, 50)}...`);
      return responseText;
    } catch (modelError) {
      console.error('Error with Gemini model:', modelError);
      
      // More detailed error handling based on specific error types
      const errorMessage = modelError.message || '';
      
      // Handle specific model errors with appropriate messages
      if (errorMessage.includes('safety') || errorMessage.includes('harmful')) {
        console.warn('Content filtered by safety system');
        return "I'm sorry, but I can't provide a response to that query due to content safety restrictions.";
      } else if (errorMessage.includes('quota') || errorMessage.includes('rate')) {
        console.warn('API quota or rate limit exceeded');
        return "I've reached my limit of how many questions I can answer right now. Please try again in a few minutes.";
      } else if (errorMessage.includes('invalid') || errorMessage.includes('parameter')) {
        console.warn('Invalid API parameters');
        return "I encountered a technical issue with my AI service. Our team has been notified.";
      } else if (errorMessage.includes('authentication') || errorMessage.includes('key')) {
        // Critical error - notify about potential API key issue
        console.error('API key or authentication error - check environment variables');
        return "I'm experiencing an authentication issue with my AI service. Please notify the site administrator.";
      }
      
      // Generic fallback for unspecified errors
      return "I'm sorry, I couldn't connect to my AI brain right now. Please try again in a moment.";
    }
  } catch (error) {
    console.error('Error generating chat response:', error);
    
    // Determine the error type for a more helpful response
    const errorType = determineErrorType(error);
    const fallbackMessage = getFallbackResponse(errorType);
    
    console.log(`Returning fallback response for error type: ${errorType}`);
    return fallbackMessage;
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