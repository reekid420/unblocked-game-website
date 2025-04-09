// Import required modules
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { createBareServer } = require('@tomphttp/bare-server-node');
const socketIo = require('socket.io');
const cors = require('cors');

// Configure app and server
const app = express();
const port = process.env.PORT || 8080;
// Create server first, then attach app later
const server = http.createServer();

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

// CORS middleware - important for service worker functionality
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: '*',
  credentials: true
}));

// Add security, CORS, and NO-CACHE headers for ALL responses
// IMPORTANT: This middleware must be placed BEFORE any routes that send responses
app.use((req, res, next) => {
  // CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('Referrer-Policy', 'no-referrer-when-downgrade');
  
  // Force NO CACHING for ALL files to always query fresh files
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  res.header('Surrogate-Control', 'no-store');
  
  // Set a unique ETag based on timestamp to force revalidation
  res.header('ETag', `"${Date.now()}-${Math.random().toString(36).substring(2, 15)}"`);
  
  // Disable client-side caching
  res.header('Clear-Site-Data', '"cache"');
  
  next();
});

// Middleware to prevent header setting after response sent
app.use((err, req, res, next) => {
  if (res.headersSent) {
    console.warn('Attempted to set headers after they were sent to the client');
    return next(err);
  }
  next(err);
});

// Serve static assets - IMPORTANT: Order matters here, from most specific to least specific

// Special route for UV service worker files to ensure proper MIME types
app.get('/assets/uv/uv.sw.js', (req, res) => {
  // Very strong cache control headers to prevent caching
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  // Add a random ETag to force reload
  res.setHeader('ETag', `"${Date.now()}"`);
  res.sendFile(path.join(__dirname, 'assets', 'uv', 'uv.sw.js'));
});

// Special routes for UV bundle files with strong cache control
app.get('/assets/uv/uv.bundle.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('ETag', `"${Date.now()}"`);
  res.sendFile(path.join(__dirname, 'assets', 'uv', 'uv.bundle.js'));
});

app.get('/assets/uv/uv.config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('ETag', `"${Date.now()}"`);
  res.sendFile(path.join(__dirname, 'assets', 'uv', 'uv.config.js'));
});

app.get('/assets/uv/bare.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('ETag', `"${Date.now()}"`);
  res.sendFile(path.join(__dirname, 'assets', 'uv', 'bare.js'));
});

// Regular static asset serving
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  setHeaders: (res, path, stat) => {
    // Set proper content types for specific file extensions
    if (path.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
    }
  }
}));

app.use('/js', express.static(path.join(__dirname, 'js'), {
  setHeaders: (res, path, stat) => {
    res.set('Content-Type', 'application/javascript');
  }
}));

// Serve files from public directory with /public prefix
app.use('/public', express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path, stat) => {
    if (path.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
    }
  }
}));

// Also serve files from public directly for backward compatibility
app.use(express.static(path.join(__dirname, 'public')));

// Import and mount API routes
const apiRoutes = require('./routes');
app.use('/api', apiRoutes);

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

// Serve HTML files directly if they exist at root level
app.get('*.html', (req, res, next) => {
  const url = req.url;
  
  // Skip if it's for the bare server or known API endpoints
  if (url.startsWith('/bare-server/') || 
      url.startsWith('/bare-info/') || 
      url.startsWith('/assets/') ||
      url.startsWith('/api/') ||
      url.startsWith('/socket.io/')) {
    return next();
  }
  
  // Get the filename from the URL
  const htmlFile = path.basename(url);
  const htmlPath = path.join(__dirname, htmlFile);
  
  // Check if the HTML file exists
  if (fs.existsSync(htmlPath)) {
    console.log(`Serving HTML file directly: ${htmlFile}`);
    // End the request here - IMPORTANT: Do not call next() after sending a response
    return res.sendFile(htmlPath);
  }
  
  // If file doesn't exist, proceed to next handler
  next();
});

// Handle specific static files
app.get('/favicon.ico', (req, res) => {
  return res.sendFile(path.join(__dirname, 'assets', 'favicon.ico'));
});

// Fallback to index.html for other routes (SPA style)
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
  
  // For WordPress/common bot scanning paths, silently serve index without logging
  if (url.includes('wp-admin') || url.includes('wordpress')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  
  console.log(`Serving index.html for route: ${url}`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Bare server handler with improved error logging
server.on('request', (req, res) => {
  if (bareServer.shouldRoute(req)) {
    console.log(`[Bare Server] Routing request: ${req.url}`);
    bareServer.routeRequest(req, res).catch(error => {
      console.error(`[Bare Server] Error handling request: ${req.url}`, error);
      // Try to send error response if headers haven't been sent
      if (!res.headersSent) {
        res.writeHead(500);
        res.end(JSON.stringify({
          error: true,
          message: 'Internal Bare Server Error',
          code: error.code || 'UNKNOWN_ERROR'
        }));
      }
    });
  } else if (req.url.startsWith('/bare-server')) {
    console.log(`[Bare Server] Non-routable bare request: ${req.url}`);
    res.writeHead(400);
    res.end('Not found.');
  } else {
    app(req, res);
  }
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

// Start the server with clear IPv4 binding
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}/`);
}); 