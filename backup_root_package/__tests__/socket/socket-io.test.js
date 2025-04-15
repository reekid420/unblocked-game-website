/**
 * @jest-environment node
 */

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const express = require('express');

describe('Socket.io Integration', () => {
  let io, serverSocket, clientSocket, httpServer, app;
  
  beforeAll((done) => {
    // Create express app and http server
    app = express();
    httpServer = http.createServer(app);
    
    // Initialize Socket.io server
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    
    // Start the server
    httpServer.listen(() => {
      const port = httpServer.address().port;
      
      // Setup client connection
      clientSocket = Client(`http://localhost:${port}`);
      
      // Wait for connection to establish
      io.on('connection', (socket) => {
        serverSocket = socket;
        done();
      });
    });
  });
  
  afterAll(() => {
    // Cleanup
    if (clientSocket) clientSocket.disconnect();
    if (io) io.close();
    if (httpServer) httpServer.close();
  });
  
  test('should establish connection between client and server', (done) => {
    // Test basic connection
    expect(serverSocket).toBeDefined();
    expect(clientSocket.connected).toBe(true);
    done();
  });
  
  test('should receive message from client', (done) => {
    // Setup server to listen for message
    serverSocket.on('test-message', (data) => {
      expect(data).toEqual({ message: 'Hello from client' });
      done();
    });
    
    // Send message from client
    clientSocket.emit('test-message', { message: 'Hello from client' });
  });
  
  test('should send message to client', (done) => {
    // Setup client to listen for message
    clientSocket.on('test-response', (data) => {
      expect(data).toEqual({ message: 'Hello from server' });
      done();
    });
    
    // Send message from server
    serverSocket.emit('test-response', { message: 'Hello from server' });
  });
  
  test('should handle room functionality', (done) => {
    // Setup another client
    const clientSocket2 = Client(`http://localhost:${httpServer.address().port}`);
    
    // Wait for second client to connect
    io.on('connection', (socket) => {
      if (socket.id !== serverSocket.id) {
        // Both clients are now connected
        
        // Join both clients to a room
        serverSocket.join('test-room');
        socket.join('test-room');
        
        // Setup second client to listen for room message
        clientSocket2.on('room-message', (data) => {
          expect(data).toEqual({ message: 'Hello room' });
          
          // Cleanup
          clientSocket2.disconnect();
          done();
        });
        
        // Send message to the room
        io.to('test-room').emit('room-message', { message: 'Hello room' });
      }
    });
  });
  
  test('should handle disconnection', (done) => {
    // Setup server to listen for disconnect
    serverSocket.on('disconnect', () => {
      expect(clientSocket.connected).toBe(false);
      done();
    });
    
    // Disconnect client
    clientSocket.disconnect();
  });
  
  test('should handle reconnection', (done) => {
    // Create a new client that will reconnect
    const reconnectingClient = Client(`http://localhost:${httpServer.address().port}`, {
      reconnection: true,
      reconnectionDelay: 100,
      reconnectionAttempts: 3
    });
    
    // Setup for reconnection test
    let disconnected = false;
    
    reconnectingClient.on('connect', () => {
      if (disconnected) {
        // This is a reconnection
        expect(reconnectingClient.connected).toBe(true);
        reconnectingClient.disconnect();
        done();
      } else {
        // Force a disconnection to test reconnection
        reconnectingClient.io.engine.close();
        disconnected = true;
      }
    });
  });
  
  test('should handle errors gracefully', (done) => {
    // Create a new client and server socket pair
    const errorClient = Client(`http://localhost:${httpServer.address().port}`);
    
    // Setup error handling on server
    io.on('connection', (socket) => {
      socket.on('error', (err) => {
        expect(err).toBeDefined();
        errorClient.disconnect();
        done();
      });
      
      // Emit an event that will cause an error
      socket.emit('trigger-error');
    });
    
    // Setup client to trigger an error
    errorClient.on('trigger-error', () => {
      // Simulate an error
      errorClient.emit('error', new Error('Test error'));
    });
  });
  
  test('should handle middleware', (done) => {
    // Setup middleware
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (token === 'valid-token') {
        socket.user = { id: 1, username: 'test-user' };
        next();
      } else {
        next(new Error('Authentication error'));
      }
    });
    
    // Create a client with valid token
    const authClient = Client(`http://localhost:${httpServer.address().port}`, {
      auth: {
        token: 'valid-token'
      }
    });
    
    // Create a client with invalid token
    const unauthClient = Client(`http://localhost:${httpServer.address().port}`, {
      auth: {
        token: 'invalid-token'
      }
    });
    
    // Handle connection error for unauthorized client
    unauthClient.on('connect_error', (err) => {
      expect(err.message).toBe('Authentication error');
      
      // Check if authorized client connected successfully
      expect(authClient.connected).toBe(true);
      
      // Cleanup
      authClient.disconnect();
      unauthClient.disconnect();
      done();
    });
  });
});
