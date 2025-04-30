import express from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';
// @ts-ignore
import { authenticate } from '../middleware/auth.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';

const router = express.Router();

/**
 * AI Chat endpoint
 * POST /api/ai-chat
 */
router.post('/chat', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { message, conversationId, systemPrompt, model, temperature, top_k, top_p, max_output_tokens } = req.body;
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    // Forward to Python FastAPI backend
    const response = await axios.post(
      process.env.PYTHON_PROXY_URL + '/ai/chat',
      {
        message,
        conversation_id: conversationId,
        system_prompt: systemPrompt,
        model,
        temperature,
        top_k,
        top_p,
        max_output_tokens
      },
      {
        headers: {
          'Authorization': req.headers['authorization'] || '',
          'Content-Type': 'application/json'
        }
      }
    );
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('AI chat proxy error:', error.message);
    if (error.response) {
      res.status(error.response.status || 500).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Failed to proxy AI chat request', message: error.message });
      return;

    }
  }
});

/**
 * Get suggested topics for AI chat
 * GET /api/ai-chat/topics
 */
router.get('/topics', async (req: Request, res: Response): Promise<void> => {
  try {
    // Proxy to Python FastAPI backend
    const response = await axios.get(process.env.PYTHON_PROXY_URL + '/ai/ai-chat/topics');
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('Error proxying topics:', error.message);
    if (error.response) {
      res.status(error.response.status || 500).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Failed to proxy topics request', message: error.message });
    }
  }
});

export default router;
