/**
 * Google Generative AI (Gemini) API integration
 */
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Store conversations in memory (in a real app, use a database)
const chatSessions = new Map();

// Session timeout in ms (1 hour)
const SESSION_TIMEOUT = 3600000;

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
 * Generate a chat response using the Gemini API
 * @param {string} userId - User ID for maintaining chat history
 * @param {string} message - User message
 * @returns {Promise<string>} AI response
 */
async function generateChatResponse(userId, message) {
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    // Add user message to history
    session.history.push({ role: 'user', parts: [{ text: message }] });
    
    // Start a chat with history
    const chat = model.startChat({
      history: session.history,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });
    
    // Generate response
    const result = await chat.sendMessage(message);
    const response = result.response;
    const responseText = response.text();
    
    // Add AI response to history
    session.history.push({ role: 'model', parts: [{ text: responseText }] });
    
    // Limit history to 20 messages to prevent context overflow
    if (session.history.length > 20) {
      session.history = session.history.slice(session.history.length - 20);
    }
    
    return responseText;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return "I'm sorry, I encountered an error while processing your request.";
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

module.exports = {
  generateChatResponse,
  cleanupOldSessions
}; 