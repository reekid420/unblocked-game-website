/**
 * @jest-environment node
 */

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Create a mock secret for JWT
const JWT_SECRET = 'test-secret-key';

// Mock the environment variables
process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';

// Create a simple middleware for testing
const apiAuthMiddleware = (req, res, next) => {
  // Skip auth for options requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
};

// Create a rate limiting middleware for testing
const rateLimitMiddleware = (req, res, next) => {
  // Simple mock implementation
  const ip = req.ip || req.connection.remoteAddress;
  
  // For testing, only limit a specific IP
  if (ip === '192.168.1.100') {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  next();
};

// Create a logging middleware for testing
const loggingMiddleware = (req, res, next) => {
  // Add request timestamp
  req.timestamp = Date.now();
  
  // Mock logging
  console.log = jest.fn();
  console.log(`[${new Date(req.timestamp).toISOString()}] ${req.method} ${req.url}`);
  
  next();
};

// Create a test app
const app = express();
app.use(express.json());
app.use(loggingMiddleware);

// Apply rate limiting to all routes
app.use(rateLimitMiddleware);

// Public routes
app.get('/api/public', (req, res) => {
  res.status(200).json({ message: 'Public API endpoint' });
});

// Protected routes
app.use('/api/protected', apiAuthMiddleware);
app.get('/api/protected', (req, res) => {
  res.status(200).json({ message: 'Protected API endpoint', user: req.user });
});

// Test suite for API middleware
describe('API Middleware', () => {
  let agent;
  
  beforeAll(() => {
    agent = request(app);
  });
  
  describe('Public Routes', () => {
    test('GET /api/public should be accessible without authentication', async () => {
      const response = await agent.get('/api/public');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Public API endpoint' });
    });
  });
  
  describe('Authentication Middleware', () => {
    test('GET /api/protected should return 401 without token', async () => {
      const response = await agent.get('/api/protected');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized - No token provided' });
    });
    
    test('GET /api/protected should return 401 with invalid token', async () => {
      const response = await agent
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized - Invalid token' });
    });
    
    test('GET /api/protected should return 200 with valid token', async () => {
      // Create a valid token
      const user = { id: 1, username: 'testuser' };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
      
      const response = await agent
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ 
        message: 'Protected API endpoint', 
        user: expect.objectContaining({ 
          id: 1, 
          username: 'testuser',
          iat: expect.any(Number),
          exp: expect.any(Number)
        }) 
      });
    });
    
    test('OPTIONS request should bypass authentication (CORS preflight)', async () => {
      const response = await agent
        .options('/api/protected')
        .set('Access-Control-Request-Method', 'GET')
        .set('Origin', 'http://localhost:3000');
      
      // OPTIONS requests should not be blocked by auth middleware
      expect(response.status).not.toBe(401);
    });
  });
  
  describe('Rate Limiting Middleware', () => {
    test('Should allow normal requests', async () => {
      const response = await agent.get('/api/public');
      expect(response.status).toBe(200);
    });
    
    test('Should block rate-limited IP addresses', async () => {
      // Mock the IP address for this request
      app.use((req, res, next) => {
        req.ip = '192.168.1.100'; // This IP is rate-limited in our mock middleware
        next();
      });
      
      const rateLimitedAgent = request(app);
      const response = await rateLimitedAgent.get('/api/public');
      expect(response.status).toBe(429);
      expect(response.body).toEqual({ error: 'Too many requests' });
    });
  });
  
  describe('Logging Middleware', () => {
    test('Should add timestamp to request', async () => {
      // Create a new route that exposes the timestamp
      app.get('/api/timestamp', (req, res) => {
        res.status(200).json({ timestamp: req.timestamp });
      });
      
      const response = await agent.get('/api/timestamp');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.timestamp).toBe('number');
    });
    
    test('Should log request details', async () => {
      // Spy on console.log
      const spy = jest.spyOn(console, 'log');
      
      await agent.get('/api/public');
      
      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('GET /api/public'));
      
      spy.mockRestore();
    });
  });
});
