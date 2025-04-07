// Import required modules
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { createBareServer } = require('@tomphttp/bare-server-node');
const socketIo = require('socket.io');

// Configure app and server
const app = express();
const port = process.env.PORT || 8080;
const server = http.createServer(app);

// Set up Socket.io
const io = socketIo(server);

// Create a Bare server instance
const bareServer = createBareServer('/bare-server/', {
  logErrors: true,
  maintainer: {
    email: 'admin@example.com',
    website: 'https://example.com'
  },
  cors: {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// API Info endpoint for bare server
app.get('/bare-info/', (req, res) => {
  console.log('Handling API Info request for bare server');
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  // Return a basic response with server info
  return res.json({
    status: 'ok',
    versions: [3],
    language: 'NodeJS',
    memoryUsage: process.memoryUsage(),
    maintainer: {
      email: 'admin@example.com',
      website: 'https://example.com'
    },
    project: {
      name: 'Bare Server',
      repository: 'https://github.com/tomphttp/bare-server-node',
      version: '2.0.0'
    }
  });
});

// Redirect old /bare/ paths to /bare-info/ for compatibility
app.get(['/bare/', '/bare/v1/', '/bare/v2/', '/bare/v3/'], (req, res) => {
  console.log('Redirecting old bare path to /bare-info/');
  res.redirect(307, '/bare-info/');
});

// Serve index.html for all routes except /bare-server/ and API routes
app.get('*', (req, res, next) => {
  const url = req.url;
  
  // Skip if it's for the bare server or known API endpoints
  if (url.startsWith('/bare-server/') || 
      url.startsWith('/bare-info/') || 
      url.startsWith('/assets/') ||
      url.startsWith('/api/') ||
      url.startsWith('/socket.io/')) {
    return next();
  }
  
  console.log(`Serving index.html for route: ${url}`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Setup WebSocket handling
server.on('upgrade', (req, socket, head) => {
  console.log(`Processing WebSocket upgrade: ${req.url}`);
  
  // Add error handling to the socket
  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
  
  // Handle bare server WebSocket requests
  if (req.url.startsWith('/bare-server/')) {
    console.log('Handling Bare server WebSocket upgrade');
    bareServer.upgradeWebSocket(req, socket, head);
    return;
  }
  
  // Handle socket.io WebSocket requests
  if (req.url.startsWith('/socket.io/')) {
    console.log('Handling Socket.io WebSocket upgrade');
    io.engine.handleUpgrade(req, socket, head);
    return;
  }
  
  // Close the connection if no handler was found
  console.log('No WebSocket handler found, closing connection');
  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

// Interval to cleanup old sessions
setInterval(() => {
  bareServer.cleanupConnections();
}, 1000 * 60 * 60); // 1 hour

// Handle all HTTP requests
server.on('request', (req, res) => {
  // Check if this is a bare server request
  if (req.url.startsWith('/bare-server/')) {
    const bareHeaders = [
      'x-bare-host',
      'x-bare-protocol',
      'x-bare-path',
      'x-bare-port',
      'x-bare-headers',
      'x-bare-forward-headers',
      'x-bare-method'
    ];
    
    // Check if any of the request headers are bare headers
    const isBareRequest = bareHeaders.some(header => req.headers[header]);
    
    // Additional check for proxy request flag
    const isProxyRequest = req.headers['x-bare-is-proxy-request'] === 'true';
    
    console.log(`Bare server request: ${req.url}, isBareRequest: ${isBareRequest}, isProxyRequest: ${isProxyRequest}`);
    
    if (isBareRequest || isProxyRequest) {
      console.log('Handling as proxy request');
      return bareServer.routeRequest(req, res);
    } else if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS request for Bare server');
      return bareServer.routeRequest(req, res);
    } else {
      console.log('Handling as API info request, redirecting to /bare-info/');
      res.writeHead(307, { 'Location': '/bare-info/' });
      return res.end();
    }
  }
  
  // For all other requests, use Express
  app(req, res);
});

// Start the server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
}); 