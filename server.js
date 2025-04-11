// Import required modules
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { createBareServer } = require('@tomphttp/bare-server-node');
const { Server } = require('socket.io');
const cors = require('cors');

// Configure app and server
const app = express();
const port = process.env.PORT || 8080;
// Create a raw HTTP server without attaching app yet
// We'll manually route requests between the bare server and Express
const server = http.createServer();

// Set up Socket.io with proxy-friendly configuration
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  // Important for proxied environments
  path: '/socket.io/',
  serveClient: true,
  allowEIO3: true,
  // Prioritize websocket but allow polling fallback
  transports: ['websocket', 'polling'],
  // Handle connection through proxies
  allowUpgrades: true,
  upgradeTimeout: 10000,
  // Adjust timing for better performance behind proxies
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  // Increase buffer size to handle larger messages
  maxHttpBufferSize: 5e6,
  // Don't destroy upgrades
  destroyUpgrade: false,
  // Prevent CORS issues by allowing credentials
  cookie: {
    name: 'io',
    path: '/',
    httpOnly: true,
    sameSite: 'lax'
  }
});

// Import Socket.io initialization
const { initSocketServer } = require('./socket/chat-socket');
// Initialize the Socket.io server with our io instance
// Pass the io object instead of creating a new one in chat-socket.js
initSocketServer(io);

// Create a Bare server instance with enhanced configuration
const bareServer = createBareServer('/bare-server/', {
  // Enable detailed logging for debugging
  logErrors: true,
  verbose: true,
  // Server identity information
  maintainer: {
    email: 'admin@example.com',
    website: 'https://example.com'
  },
  // Data directory for bare server
  directory: path.join(__dirname, 'bare'),
  // Allow browser validation to pass
  filterRemote: (url) => true,
  // Enhanced CORS settings
  cors: {
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Content-Length', 'Authorization', 'X-Requested-With', 'Cache']
  },
  // Keepalive timeout in milliseconds
  keepAliveTimeout: 120000, // Increased timeout for better stability
  // Maximum request size in bytes (30MB)
  maxRequestSize: 30000000,
  // Improved error handling
  errorHandler: (err, req, res) => {
    console.error(`[Bare] Error in bare server: ${err.stack || err.message || err}`);
    
    // Ensure proper response format
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'Bare Server Error',
        message: err.message || 'Unknown error occurred',
        code: err.code || 'UNKNOWN_ERROR'
      }));
    }
    return true; // Mark as handled
  }
});

// Ensure bare directory exists with proper permissions
const bareDir = path.join(__dirname, 'bare');
if (!fs.existsSync(bareDir)) {
  console.log(`Creating Bare server directory: ${bareDir}`);
  fs.mkdirSync(bareDir, { recursive: true, mode: 0o755 });
}

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

// Configure the server to route requests to either the bare server or Express
server.on('request', (req, res) => {
  // Safeguard against missing URL
  if (!req.url) {
    console.warn('[Server] Request missing URL, defaulting to /');
    req.url = '/';
  }

  // Create a more comprehensive solution for response tracking
  // Track if the response has been handled
  res.locals = res.locals || {};
  res.locals.isHandled = false;

  // Create wrappers for all response methods that might send data
  const originalEnd = res.end;
  const originalWrite = res.write;
  const originalWriteHead = res.writeHead;
  const originalSetHeader = res.setHeader;
  const originalRemoveHeader = res.removeHeader;

  // Patch res.end to prevent multiple calls
  res.end = function() {
    if (res.locals.isHandled) {
      console.warn(`[Server] Prevented duplicate res.end for: ${req.url}`);
      return false;
    }
    res.locals.isHandled = true;
    return originalEnd.apply(this, arguments);
  };

  // Patch res.write to check if response is already handled
  res.write = function() {
    if (res.locals.isHandled) {
      console.warn(`[Server] Prevented write after end for: ${req.url}`);
      return false;
    }
    return originalWrite.apply(this, arguments);
  };

  // Patch res.writeHead to check if response is already handled
  res.writeHead = function() {
    if (res.locals.isHandled) {
      console.warn(`[Server] Prevented writeHead after end for: ${req.url}`);
      return this;
    }
    return originalWriteHead.apply(this, arguments);
  };

  // Patch res.setHeader to prevent header modification after sending
  res.setHeader = function(name, value) {
    if (res.locals.isHandled) {
      console.warn(`[Server] Prevented setHeader after end for: ${req.url}, header: ${name}`);
      return this;
    }
    return originalSetHeader.apply(this, arguments);
  };

  // Most importantly - patch removeHeader which is causing our specific error
  res.removeHeader = function(name) {
    if (res.locals.isHandled) {
      console.warn(`[Server] Prevented removeHeader after end for: ${req.url}, header: ${name}`);
      return this;
    }
    return originalRemoveHeader.apply(this, arguments);
  };

  // Check if this is a request for the Bare server
  if (bareServer.shouldRoute(req)) {
    console.log(`[Bare] Routing request to Bare server: ${req.url}`);
    try {
      // Fix content-type handling for proxy responses
      const origSetHeader = res.setHeader;
      res.setHeader = function(name, value) {
        if (name.toLowerCase() === 'content-type') {
          console.log(`[Bare] Setting Content-Type header to: ${value}`);
        }
        return origSetHeader.call(this, name, value);
      };
      
      // Tag this request as a Bare server request for middleware to recognize
      req.isBareRequest = true;
      
      // Protect against exceptions in Bare server request handling
      bareServer.routeRequest(req, res);
    } catch (error) {
      if (!res.locals.isHandled) {
        console.error(`[Bare] Error handling request: ${error.message}`);
        console.error(`[Bare] Stack: ${error.stack}`);
        try {
          res.writeHead(500, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Content-Length, Authorization'
          });
          res.end(JSON.stringify({
            error: 'Internal Server Error', 
            message: error.message,
            url: req.url,
            code: error.code || 'UNKNOWN_ERROR',
            time: new Date().toISOString()
          }));
        } catch (responseError) {
          // Last resort error handling if we can't even send an error response
          console.error(`[Server] Fatal error sending response: ${responseError.message}`);
          // Try to force-close the connection if all else fails
          try {
            if (res.socket && !res.socket.destroyed) {
              res.socket.end();
            }
          } catch (socketError) {
            console.error(`[Server] Could not end socket: ${socketError.message}`);
          }
        }
      }
    }
  } else {
    // Not a bare request, so let Express handle it
    // Wrap Express app in try/catch to handle any Express errors
    try {
      app(req, res);
    } catch (expressError) {
      console.error(`[Express] Error handling request: ${expressError.message}`);
      if (!res.locals.isHandled && !res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Express Error', message: expressError.message }));
      }
    }
  }
});

// Handle WebSocket connections for both Bare server and Socket.IO
server.on('upgrade', (req, socket, head) => {
  // Safeguard against missing URL
  if (!req.url) {
    console.warn('[Server] WebSocket request missing URL, closing connection');
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }

  // Generate a unique request ID for tracking
  const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  
  console.log(`[Server] WebSocket upgrade request ${requestId} for: ${req.url}`);
  
  try {
    // Handle Socket.IO connections first to prioritize them
    if (req.url.startsWith('/socket.io/')) {
      console.log(`[Socket.IO] Handling WebSocket upgrade ${requestId}`);
      
      // Tag the request for middleware to identify
      req.isSocketIoRequest = true;
      req.__socketio = true;
      
      // Add error handler to socket
      socket.on('error', (err) => {
        console.error(`[Socket.IO] Socket error on connection ${requestId}: ${err.message}`);
      });
      
      // Use Socket.IO's engine to handle the upgrade
      io.engine.handleUpgrade(req, socket, head, (ws) => {
        try {
          console.log(`[Socket.IO] WebSocket connection established for ${requestId}`);
          io.engine.emit('connection', ws, req);
        } catch (wsError) {
          console.error(`[Socket.IO] WebSocket connection error: ${wsError.message}`);
        }
      });
    } 
    // Then handle Bare server WebSocket connections
    else if (bareServer.shouldRoute(req)) {
      console.log(`[Bare] Handling WebSocket upgrade ${requestId}`);
      req.isBareUpgrade = true;
      bareServer.routeUpgrade(req, socket, head);
    } 
    // Reject any other WebSocket connections
    else {
      console.log(`[Server] Unknown WebSocket upgrade request ${requestId}: ${req.url}`);
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  } catch (error) {
    console.error(`[Server] Error handling WebSocket upgrade ${requestId}:`, error);
    
    // Safely close the socket
    try {
      if (socket.writable) {
        socket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      }
    } catch (endError) {
      console.error(`[Server] Could not end socket: ${endError.message}`);
    }
  }
});

// Implement response tracking middleware to prevent double handling
app.use((req, res, next) => {
  // Skip tracking for Socket.IO requests as those are handled differently
  if (req.isSocketIoRequest || req.__socketio || req.isBareRequest) {
    return next();
  }
  
  // Ensure req.locals and res.locals exist
  req.locals = req.locals || {};
  res.locals = res.locals || {};
  
  // Create unique request ID for tracking
  const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
  req.requestId = requestId;
  res.locals.requestId = requestId;
  req.locals.startTime = Date.now();
  
  // Track if the response has been handled to prevent ERR_HTTP_HEADERS_SENT
  res.locals.isHandled = false;
  
  // Log the beginning of request processing
  console.log(`[Express] Processing request ${requestId}: ${req.method} ${req.url}`);
  
  // Add response finish listener to log completion
  res.on('finish', () => {
    const duration = Date.now() - req.locals.startTime;
    console.log(`[Express] Completed request ${requestId}: ${res.statusCode} (${duration}ms)`);
  });

  // Add safety wrapper for response methods
  const originalEnd = res.end;
  const originalSend = res.send;
  const originalJson = res.json;
  const originalRedirect = res.redirect;
  
  // Wrap res.end to prevent double-ending
  res.end = function() {
    if (res.locals.isHandled) {
      console.warn(`[Express] Prevented duplicate res.end for ${requestId}: ${req.url}`);
      return this;
    }
    res.locals.isHandled = true;
    return originalEnd.apply(this, arguments);
  };
  
  // Wrap res.send to prevent double-sending
  res.send = function() {
    if (res.locals.isHandled) {
      console.warn(`[Express] Prevented duplicate res.send for ${requestId}: ${req.url}`);
      return this;
    }
    return originalSend.apply(this, arguments);
  };
  
  // Wrap res.json to prevent double-sending
  res.json = function() {
    if (res.locals.isHandled) {
      console.warn(`[Express] Prevented duplicate res.json for ${requestId}: ${req.url}`);
      return this;
    }
    return originalJson.apply(this, arguments);
  };
  
  // Wrap res.redirect to prevent double-redirecting
  res.redirect = function() {
    if (res.locals.isHandled) {
      console.warn(`[Express] Prevented duplicate res.redirect for ${requestId}: ${req.url}`);
      return this;
    }
    return originalRedirect.apply(this, arguments);
  };

  // Add security, CORS, and NO-CACHE headers for ALL responses
  // Skip header modifications for Socket.IO and Bare server requests to prevent conflicts
  if (!req.isSocketIoRequest && !req.__socketio && !req.isBareRequest) {
  
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
  
  // Remove the problematic header that's causing browser warnings
  // res.header('Clear-Site-Data', '"cache"');
  }
  
  next();
});

// Enhanced error middleware to better handle header setting after response sent
app.use((err, req, res, next) => {
  if (res.headersSent) {
    console.warn(`Attempted to set headers after they were sent to the client: ${req.url}`);
    console.warn(`Error: ${err ? err.message : 'Unknown'}`);
    return next(err);
  }
  next(err);
});

// Add middleware to prevent double-responses
app.use((req, res, next) => {
  // Create a flag on the request object to track if it's been handled
  if (req.__handled === undefined) {
    req.__handled = false;
    
    // Save original methods to detect improper usage
    const originalSend = res.send;
    const originalJson = res.json;
    const originalSendFile = res.sendFile;
    const originalEnd = res.end;
    
    // Override methods to check if response already sent
    res.send = function(...args) {
      if (req.__handled || res.headersSent) {
        console.warn(`[WARNING] Attempted to send response multiple times: ${req.url}`);
        return this;
      }
      req.__handled = true;
      return originalSend.apply(this, args);
    };
    
    res.json = function(...args) {
      if (req.__handled || res.headersSent) {
        console.warn(`[WARNING] Attempted to send JSON response multiple times: ${req.url}`);
        return this;
      }
      req.__handled = true;
      return originalJson.apply(this, args);
    };
    
    res.sendFile = function(...args) {
      if (req.__handled || res.headersSent) {
        console.warn(`[WARNING] Attempted to send file multiple times: ${req.url}`);
        return this;
      }
      req.__handled = true;
      return originalSendFile.apply(this, args);
    };
    
    res.end = function(...args) {
      if (req.__handled) {
        console.warn(`[WARNING] Attempted to end response multiple times: ${req.url}`);
        return this;
      }
      req.__handled = true;
      return originalEnd.apply(this, args);
    };
  }
  next();
});

// Special middleware to handle Socket.io client script and polling requests properly
app.use('/socket.io/', (req, res, next) => {
  // Mark this as a socketio request to avoid conflicts
  req.__socketio = true;
  req.isSocketIoRequest = true;
  
  // Add custom headers to help proxies properly handle Socket.IO requests
  res.setHeader('X-Accel-Buffering', 'no'); // Prevent NGINX buffering
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // Prevent caching
  
  // Handle long-polling requests gracefully with proper cleanup
  res.on('close', () => {
    if (!res.locals.isHandled && !res.headersSent) {
      // Connection closed before response was fully sent
      res.locals.isHandled = true;
      console.log(`[Socket.IO] Connection closed prematurely: ${req.url}`);
    }
  });
  
  // Specialized error handling for Socket.IO
  res.on('error', (err) => {
    console.error(`[Socket.IO] Response error: ${err.message}`);
    res.locals.isHandled = true;
  });
  
  // Socket.IO polling requests often have long timeouts, handle them properly
  req.setTimeout(120000, () => {
    if (!res.headersSent && !res.locals.isHandled) {
      console.log(`[Socket.IO] Request timeout: ${req.url}`);
      res.locals.isHandled = true;
      try {
        res.status(408).end('Request Timeout');
      } catch (err) {
        console.error(`[Socket.IO] Error sending timeout response: ${err.message}`);
      }
    }
  });
  
  // For Socket.IO handshakes, ensure proper content type
  if (req.url.includes('transport=polling')) {
    res.setHeader('Content-Type', 'application/json');
  }
  
  next();
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

// UV assets that have already been handled by specific routes
const handledUvAssets = [
  '/assets/uv/uv.config.js',
  '/assets/uv/bare.js',
  '/assets/uv/uv.bundle.js',
  '/assets/uv/uv.sw.js'
];

// Regular static asset serving
app.use('/assets', (req, res, next) => {
  // Skip if this is an asset we're already handling with a specific route
  const assetPath = req.path;
  const fullPath = '/assets' + assetPath;
  
  if (handledUvAssets.some(asset => fullPath === asset || fullPath.startsWith(asset + '?'))) {
    console.log(`Skipping duplicate handling for ${fullPath}`);
    return next('route'); // Skip to the next route handler, bypassing static middleware
  }
  
  next(); // Continue to static middleware
}, express.static(path.join(__dirname, 'assets'), {
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
  // Exit early if the request has already been handled
  if (req.__handled || res.headersSent) {
    return next();
  }
  
  const url = req.url;
  
  // Skip if it's for the bare server or known API endpoints
  if (url.startsWith('/bare-server/') || 
      url.startsWith('/bare-info/') || 
      url.startsWith('/assets/') ||
      url.startsWith('/api/') ||
      url.startsWith('/socket.io')) {
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
  // Exit early if the request has already been handled
  if (req.__handled || res.headersSent) {
    return next();
  }
  
  const url = req.url;
  
  // Skip if it's for the bare server or known API endpoints
  if (url.startsWith('/bare-server/') || 
      url.startsWith('/bare-info/') || 
      url.startsWith('/assets/') ||
      url.startsWith('/api/') ||
      url.startsWith('/socket.io')) {
    return next();
  }
  
  // For WordPress/common bot scanning paths, silently serve index without logging
  if (url.includes('wp-admin') || url.includes('wordpress')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  
  console.log(`Serving index.html for route: ${url}`);
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// THIS IS IMPORTANT: We don't need the request handler since we already attached the app to the server
// This prevents the dual-handling of requests that causes the headers already sent error

// Handle WebSocket upgrades for Bare Server only
// Let Socket.io handle its own upgrades automatically
server.on('upgrade', (req, socket, head) => {
  // Skip Socket.io WebSocket upgrades - Socket.io handles these automatically
  if (req.url.startsWith('/socket.io/')) {
    console.log(`Letting Socket.io handle its own WebSocket upgrade: ${req.url}`);
    return; // Let Socket.io handle its own upgrades
  }
  
  // Handle Bare server WebSocket upgrades
  if (req.url.startsWith('/bare-server/')) {
    console.log(`Processing Bare server WebSocket upgrade: ${req.url}`);
    
    socket.on('error', (err) => {
      console.error('Bare server socket error:', err);
    });
    
    try {
      bareServer.upgradeWebSocket(req, socket, head);
    } catch (error) {
      console.error('Bare server upgrade error:', error);
      try {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      } catch (socketError) {
        console.error('Failed to destroy socket after error:', socketError);
      }
    }
    return;
  }
  
  // Reject all other WebSocket connections
  console.log(`Rejecting unhandled WebSocket upgrade: ${req.url}`);
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