/**
 * Python Proxy Routes
 * Handles routing requests to the Python FastAPI proxy server
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Python Proxy Configuration
const PYTHON_PROXY_URL = process.env.PYTHON_PROXY_URL || 'http://localhost:6078';
const PYTHON_PROXY_ENABLED = process.env.PYTHON_PROXY_ENABLED === 'true';

// Logger for Python proxy
const logger = {
  info: (message, ...args) => console.log(`[PythonProxy] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[PythonProxy] ${message}`, ...args),
  error: (message, ...args) => console.error(`[PythonProxy] ${message}`, ...args)
};

// Middleware to check if Python proxy is enabled
const checkProxyEnabled = (req, res, next) => {
  if (!PYTHON_PROXY_ENABLED) {
    return res.status(503).json({
      error: 'Python proxy is not enabled',
      message: 'The Python proxy service is currently disabled'
    });
  }
  next();
};

// Middleware to add authentication token to requests
const addAuthToken = (req, res, next) => {
  // Get user ID from session or default to anonymous
  const userId = req.session?.userId || 'anonymous';
  
  // Create a JWT token for the Python proxy
  const token = jwt.sign(
    { userId, role: 'user' },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '1h' }
  );
  
  // Add token to request for use in routes
  req.proxyToken = token;
  next();
};

/**
 * Health check route for the Python proxy
 */
router.get('/health', checkProxyEnabled, async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_PROXY_URL}/health`);
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Health check failed:', error.message);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * Proxy route for web requests
 */
router.post('/proxy', checkProxyEnabled, addAuthToken, async (req, res) => {
  const { url, method = 'GET', headers = {}, body } = req.body;
  
  if (!url) {
    return res.status(400).json({
      error: 'Missing URL',
      message: 'URL is required for proxy requests'
    });
  }
  
  try {
    // Add auth token to headers
    const requestHeaders = {
      ...headers,
      'Authorization': `Bearer ${req.proxyToken}`
    };
    
    // Generate a unique request ID
    const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    requestHeaders['X-Request-ID'] = requestId;
    
    logger.info(`Proxying request ${requestId} to: ${url}`);
    
    // Forward the request to the Python proxy
    const response = await axios({
      url: `${PYTHON_PROXY_URL}/proxy`,
      method: 'POST',
      headers: requestHeaders,
      data: {
        url,
        method,
        headers: requestHeaders,
        body
      },
      responseType: 'stream'
    });
    
    // Set response headers
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    // Stream the response back to the client
    response.data.pipe(res);
  } catch (error) {
    logger.error('Proxy request failed:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Proxy request failed',
      message: error.message,
      details: error.response?.data
    });
  }
});

/**
 * Direct proxy route that redirects to the target URL
 */
router.get('/service/*', checkProxyEnabled, (req, res) => {
  // Extract the target URL from the path
  const encodedUrl = req.params[0];
  
  if (!encodedUrl) {
    return res.status(400).json({
      error: 'Missing URL',
      message: 'URL is required for proxy requests'
    });
  }
  
  try {
    // Decode the URL
    const targetUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
    
    // Redirect to the proxy form submission
    res.render('proxy-redirect', {
      url: targetUrl,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  } catch (error) {
    logger.error('URL decoding failed:', error.message);
    res.status(400).json({
      error: 'Invalid URL encoding',
      message: error.message
    });
  }
});

/**
 * Chat API route
 */
router.post('/chat', checkProxyEnabled, addAuthToken, async (req, res) => {
  const { message, conversationId } = req.body;
  const userId = req.session?.userId || 'anonymous';
  
  if (!message) {
    return res.status(400).json({
      error: 'Missing message',
      message: 'Message is required for chat requests'
    });
  }
  
  try {
    // Forward the request to the Python proxy
    const response = await axios.post(
      `${PYTHON_PROXY_URL}/api/chat`,
      {
        message,
        userId,
        conversationId
      },
      {
        headers: {
          'Authorization': `Bearer ${req.proxyToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Chat request failed:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Chat request failed',
      message: error.message,
      details: error.response?.data
    });
  }
});

/**
 * Topics API route
 */
router.get('/topics', checkProxyEnabled, addAuthToken, async (req, res) => {
  try {
    // Forward the request to the Python proxy
    const response = await axios.get(
      `${PYTHON_PROXY_URL}/api/topics`,
      {
        headers: {
          'Authorization': `Bearer ${req.proxyToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Topics request failed:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Topics request failed',
      message: error.message,
      details: error.response?.data
    });
  }
});

/**
 * Conversation history API route
 */
router.get('/conversations/:conversationId', checkProxyEnabled, addAuthToken, async (req, res) => {
  const { conversationId } = req.params;
  
  try {
    // Forward the request to the Python proxy
    const response = await axios.get(
      `${PYTHON_PROXY_URL}/api/conversations/${conversationId}`,
      {
        headers: {
          'Authorization': `Bearer ${req.proxyToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Conversation request failed:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Conversation request failed',
      message: error.message,
      details: error.response?.data
    });
  }
});

/**
 * Delete conversation API route
 */
router.delete('/conversations/:conversationId', checkProxyEnabled, addAuthToken, async (req, res) => {
  const { conversationId } = req.params;
  
  try {
    // Forward the request to the Python proxy
    const response = await axios.delete(
      `${PYTHON_PROXY_URL}/api/conversations/${conversationId}`,
      {
        headers: {
          'Authorization': `Bearer ${req.proxyToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Delete conversation request failed:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Delete conversation request failed',
      message: error.message,
      details: error.response?.data
    });
  }
});

module.exports = router;
