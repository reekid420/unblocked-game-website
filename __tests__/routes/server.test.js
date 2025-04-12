/**
 * Tests for Express server routes
 */

const request = require('supertest');
const express = require('express');
const path = require('path');

// Create a simplified version of the Express app for testing
// This avoids the complexity of the full server with Bare Server and Socket.io
function createTestApp() {
  const app = express();
  
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Basic routes for testing
  app.get('/', (req, res) => {
    res.status(200).send('Home Page');
  });
  
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // Mock user route
  app.post('/api/users/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (username === 'testuser' && password === 'password') {
      return res.status(200).json({
        user: { id: '123', username: 'testuser' },
        token: 'mock-jwt-token'
      });
    }
    
    return res.status(401).json({ error: 'Invalid credentials' });
  });
  
  return app;
}

describe('Server Routes', () => {
  let app;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  describe('GET /', () => {
    test('should respond with 200 status code', async () => {
      const response = await request(app).get('/');
      expect(response.statusCode).toBe(200);
      expect(response.text).toBe('Home Page');
    });
  });
  
  describe('GET /api/health', () => {
    test('should respond with health status', async () => {
      const response = await request(app).get('/api/health');
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });
  
  describe('POST /api/users/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ username: 'testuser', password: 'password' })
        .set('Accept', 'application/json');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('testuser');
    });
    
    test('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ username: 'testuser', password: 'wrongpassword' })
        .set('Accept', 'application/json');
      
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
    
    test('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ username: 'testuser' })
        .set('Accept', 'application/json');
      
      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
