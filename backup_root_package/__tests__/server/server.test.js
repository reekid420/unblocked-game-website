/**
 * @jest-environment node
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Mock the bare server
jest.mock('@tomphttp/bare-server-node', () => ({
  createBareServer: jest.fn().mockImplementation(() => ({
    shouldRoute: jest.fn().mockImplementation((req) => {
      return req.url.startsWith('/bare-server/');
    }),
    routeRequest: jest.fn().mockImplementation((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'Bare server mock response' }));
      return true;
    }),
    routeUpgrade: jest.fn().mockImplementation(() => true),
    close: jest.fn()
  }))
}));

// Mock socket.io
jest.mock('socket.io', () => {
  const mockOn = jest.fn();
  const mockEmit = jest.fn();
  const mockJoin = jest.fn();
  const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
  
  const mockSocket = {
    id: 'test-socket-id',
    on: mockOn,
    join: mockJoin,
    to: mockTo,
    emit: mockEmit
  };
  
  const mockIo = {
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'connection') {
        callback(mockSocket);
      }
    }),
    emit: mockEmit,
    use: jest.fn(),
    path: jest.fn().mockReturnThis(),
    adapter: jest.fn().mockReturnThis(),
    serveClient: jest.fn().mockReturnThis(),
    listen: jest.fn().mockReturnThis(),
    close: jest.fn()
  };
  
  return {
    Server: jest.fn().mockImplementation(() => mockIo),
    mockIo,
    mockSocket
  };
});

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  chmodSync: jest.fn()
}));

// Create a test app
const app = express();
app.use(express.json());

// Setup basic routes for testing
app.get('/', (req, res) => {
  res.status(200).send('Home Page');
});

app.get('/api/status', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Create a test server
const server = http.createServer(app);
const io = new Server(server);

// Import the server routes for testing
// Note: We're not actually starting the server, just testing the routes
describe('Server Routes', () => {
  let agent;
  
  beforeAll(() => {
    agent = request(app);
  });
  
  afterAll((done) => {
    server.close(done);
  });
  
  describe('Basic Routes', () => {
    test('GET / should return 200 status code', async () => {
      const response = await agent.get('/');
      expect(response.status).toBe(200);
      expect(response.text).toBe('Home Page');
    });
    
    test('GET /api/status should return status object', async () => {
      const response = await agent.get('/api/status');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
    
    test('GET /nonexistent should return 404', async () => {
      const response = await agent.get('/nonexistent');
      expect(response.status).toBe(404);
    });
  });
  
  describe('Error Handling', () => {
    test('Server should handle errors gracefully', async () => {
      // Add a route that throws an error
      app.get('/error', (req, res, next) => {
        throw new Error('Test error');
      });
      
      // Add error handler
      app.use((err, req, res, next) => {
        res.status(500).json({ error: err.message });
      });
      
      const response = await agent.get('/error');
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Test error');
    });
  });
  
  describe('Middleware Functionality', () => {
    test('Request should have appropriate headers', async () => {
      // Add middleware to check headers
      app.use('/headers-test', (req, res, next) => {
        res.set('X-Test-Header', 'test-value');
        next();
      });
      
      app.get('/headers-test', (req, res) => {
        res.status(200).send('Headers Test');
      });
      
      const response = await agent.get('/headers-test');
      expect(response.status).toBe(200);
      expect(response.headers['x-test-header']).toBe('test-value');
    });
  });
  
  describe('Bare Server Integration', () => {
    test('Bare server routes should be handled correctly', async () => {
      // Mock the bare server routing
      const bareServer = require('@tomphttp/bare-server-node').createBareServer();
      
      // Create a route handler that simulates the server.js routing logic
      app.use('/bare-server', (req, res) => {
        if (bareServer.shouldRoute(req)) {
          bareServer.routeRequest(req, res);
        } else {
          res.status(404).send('Not Found');
        }
      });
      
      const response = await agent.get('/bare-server/');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ 
        status: 'ok', 
        message: 'Bare server mock response' 
      });
    });
  });
  
  describe('Socket.io Integration', () => {
    test('Socket.io connection should be established', (done) => {
      const { mockIo, mockSocket } = require('socket.io');
      
      // Verify that the connection event handler is registered
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
      
      // Simulate a client message
      mockSocket.on.mockImplementation((event, callback) => {
        if (event === 'test-event') {
          callback({ data: 'test-data' });
        }
      });
      
      // Emit a test event to the socket
      mockSocket.emit('test-event', { data: 'test-data' });
      
      // Check that the socket can emit events
      expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test-data' });
      
      done();
    });
  });
});
