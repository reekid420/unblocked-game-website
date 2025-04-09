const express = require('express');
const { generateChatResponse, ERROR_TYPES } = require('../api/gemini');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * AI Chat endpoint
 * POST /api/ai-chat
 */
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Call the Gemini API - now returns an object with text, error, and errorType properties
    const result = await generateChatResponse(req.user.id, message);
    
    // If there was an error but it's just rate limiting, use 429 status code
    if (result.error) {
      if (result.errorType === ERROR_TYPES.RATE_LIMITED) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded', 
          message: result.text,
          retryAfter: 60 // Suggest retry after 60 seconds
        });
      }
      
      // For other errors, still return 200 but include error info
      return res.json({ 
        response: result.text,
        hasError: true,
        errorType: result.errorType || 'UNKNOWN'
      });
    }
    
    // Normal successful response
    res.json({ response: result.text });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

/**
 * Get suggested topics for AI chat
 * GET /api/ai-chat/topics
 */
router.get('/topics', async (req, res) => {
  try {
    // In a real app, these might come from a database or be dynamically generated
    const topics = [
      "Math homework help",
      "Science concepts explained",
      "History essay research",
      "Language learning tips",
      "Coding tutorials",
      "Literature analysis",
      "Study techniques"
    ];
    
    res.json({ topics });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch suggested topics' });
  }
});

module.exports = router; 