// Main server implementation
const { createBareServer } = require('@tomphttp/bare-server-node');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { cleanupOldSessions } = require('./api/gemini');
const { initSocketServer } = require('./socket/chat-socket');
const apiRoutes = require('./routes/index');

// Create Express app
const app = express();

// Middleware for JSON parsing
app.use(express.json());

// Create a Bare server instance
const bareServer = createBareServer('/bare/');

// Define the port (use environment variable or default to 3000)
const port = process.env.PORT || 3000;

// Create an HTTP server that uses Express for API routes and bare-server for proxy
const server = http.createServer((req, res) => {
  // Handle bare server requests
  if (bareServer.shouldRoute(req)) {
    console.log(`[Bare Server] Handling request: ${req.url}`);
    bareServer.routeRequest(req, res);
    return;
  }

  // Pass to Express for API endpoints
  app(req, res);
});

// Initialize Socket.io
const io = initSocketServer(server);

// Setup security middleware
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Mount API routes
app.use('/api', apiRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Add a simple health check route for Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Handle WebSocket connections for the bare server
server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
    return;
  }
  
  // Handle Socket.io upgrades
  io.engine.handleUpgrade(req, socket, head);
});

// Periodically clean up old AI chat sessions
setInterval(cleanupOldSessions, 3600000); // Every hour

// Start the server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
}); 