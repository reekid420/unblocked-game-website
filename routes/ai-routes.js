const express = require('express');
const { generateChatResponse } = require('../api/gemini');
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
    
    // Call the Gemini API
    const response = await generateChatResponse(req.user.id, message);
    
    res.json({ response });
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