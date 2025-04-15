// Import required modules
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const session = require('express-session');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

// --- App and Server Initialization ---
const app = express();
const port = process.env.PORT || 8080;
const server = http.createServer(app);

// --- Socket.io Setup ---
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

// Python Proxy Configuration
const PYTHON_PROXY_URL = process.env.PYTHON_PROXY_URL || 'http://localhost:6078';
const PYTHON_PROXY_ENABLED = process.env.PYTHON_PROXY_ENABLED === 'true';

// Logger for Python proxy
const pythonProxyLogger = {
  info: (message, ...args) => console.log(`[PythonProxy] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[PythonProxy] ${message}`, ...args),
  error: (message, ...args) => console.error(`[PythonProxy] ${message}`, ...args)
};

pythonProxyLogger.info(`Python Proxy URL: ${PYTHON_PROXY_URL}`);
pythonProxyLogger.info(`Python Proxy Enabled: ${PYTHON_PROXY_ENABLED}`);

// Check Python proxy health on startup
if (PYTHON_PROXY_ENABLED) {
  axios.get(`${PYTHON_PROXY_URL}/health`)
    .then(response => {
      pythonProxyLogger.info('Python proxy health check:', response.data);
    })
    .catch(error => {
      pythonProxyLogger.error('Python proxy health check failed:', error.message);
    });
}

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: '*',
  credentials: true
}));

app.use(cookieParser());
app.use(session({
  secret: process.env.JWT_SECRET || 'default-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// --- Mount Python Proxy Router ---
const pythonProxyRoutes = require('./routes/python-proxy-routes');
app.use('/proxy', pythonProxyRoutes);

// --- Static Middleware (after proxy logic) ---
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/js', express.static(path.join(__dirname, 'js')));

app.use(express.static(path.join(__dirname, 'public')));

// --- Static Asset 404 Handler ---
app.use((req, res, next) => {
  // If the request looks like a static asset (has a file extension) and no static middleware handled it, return 404
  if (/\.[a-zA-Z0-9]{2,5}(\?|$)/.test(req.url)) {
    return res.status(404).send('Not Found');
  }
  next();
});

// --- Asset Proxy for Proxied Pages ---
app.get('*', async (req, res, next) => {
  const assetPrefixes = ['/images/', '/logos/', '/xjs/', '/gen_204', '/search', '/favicon.ico', '/css/', '/js/', '/fonts/', '/static/'];
  const referer = req.headers.referer || '';
  const isProxiedReferer = referer.includes('/service/');
  if (isProxiedReferer && assetPrefixes.some(prefix => req.path.startsWith(prefix))) {
    console.log('Asset proxy HIT for:', req.path, 'referer:', referer);
    try {
      // Guess the base URL from the referer or default to https://www.google.com
      let baseUrl = 'https://www.google.com';
      if (req.headers.referer) {
        const match = req.headers.referer.match(/\/service\/([^/]+)/);
        if (match) {
          baseUrl = Buffer.from(match[1], 'base64').toString('utf-8');
          // Always use www.google.com for Google assets
          if (baseUrl.includes('google.com') && !baseUrl.includes('www.google.com')) {
            baseUrl = baseUrl.replace('://google.com', '://www.google.com');
          }
        }
      }
      // Build the full asset URL
      const assetUrl = baseUrl.replace(/\/$/, '') + req.path;
      // Use internal POST to /proxy endpoint
      const proxyRes = await axios.post(
        'http://localhost:' + port + '/proxy/proxy',
        { url: assetUrl, method: 'GET' },
        { responseType: 'arraybuffer', validateStatus: () => true }
      );
      // Forward content type and safe headers
      const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
      res.set('Content-Type', contentType);
      const safeHeaders = ['content-length','cache-control','expires','last-modified','etag'];
      for (const h of safeHeaders) {
        if (proxyRes.headers[h]) res.set(h, proxyRes.headers[h]);
      }
      res.status(proxyRes.status).send(Buffer.from(proxyRes.data));
    } catch (err) {
      res.status(502).send('Asset proxy error: ' + (err.message || err));
    }
    return;
  }
  next();
});

// --- Visual Proxy for /service/:encodedUrl ---
app.get('/service/:encodedUrl', async (req, res) => {
  const encodedUrl = req.params.encodedUrl;
  if (!encodedUrl) {
    return res.status(400).send('Missing encoded URL');
  }
  try {
    // Decode the URL
    const url = Buffer.from(encodedUrl, 'base64').toString('utf-8');
    // POST to /proxy endpoint
    const proxyRes = await axios.post(
      'http://localhost:' + port + '/proxy/proxy',
      { url, method: 'GET' },
      { responseType: 'arraybuffer', validateStatus: () => true }
    );
    // Try to parse as JSON
    let isJson = false;
    let json = null;
    try {
      const text = Buffer.from(proxyRes.data).toString('utf8');
      json = JSON.parse(text);
      isJson = json && typeof json === 'object' && 'body' in json;
    } catch (e) {}
    if (isJson) {
      res.set('Content-Type', 'text/html');
      res.status(json.status || 200).send(json.body);
    } else {
      const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
      res.set('Content-Type', contentType);
      const safeHeaders = ['content-length','cache-control','expires','last-modified','etag'];
      for (const h of safeHeaders) {
        if (proxyRes.headers[h]) res.set(h, proxyRes.headers[h]);
      }
      res.status(proxyRes.status).send(Buffer.from(proxyRes.data));
    }
  } catch (err) {
    res.status(502).send('Proxy error: ' + (err.message || err));
  }
});

// --- Health Check ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- SPA Fallback ---
app.get('*', (req, res, next) => {
  if (req.__handled || res.headersSent) return next();
  const url = req.url;
  // Skip fallback for known server routes
  if (
    url.startsWith('/bare-server/') ||
    url.startsWith('/bare-info/') ||
    url.startsWith('/assets/') ||
    url.startsWith('/api/') ||
    url.startsWith('/socket.io')
  ) return next();
  // Skip fallback for static asset requests (has a file extension)
  if (/\.[a-zA-Z0-9]{2,5}(\?|$)/.test(url)) return next();
  if (url.includes('wp-admin') || url.includes('wordpress')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  console.log(`Serving index.html for route: ${url}`);
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Configure the server to handle requests
server.on('request', (req, res) => {
  // Safeguard against missing URL
  if (!req.url) {
    console.warn('[Server] Request missing URL, defaulting to /');
    req.url = '/';
  }

  // Only handle Socket.IO requests specially
  if (req.url.startsWith('/socket.io/')) {
    req.isSocketIoRequest = true;
    return app(req, res);
  }

  // All other requests go to Express
  app(req, res);
});

// Handle WebSocket connections for Socket.IO
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
    // Handle Socket.IO connections
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
          console.error(`[Socket.IO] Error establishing WebSocket connection for ${requestId}: ${wsError.message}`);
          try {
            if (ws && ws.terminate) {
              ws.terminate();
            }
          } catch (terminateError) {
            console.error(`[Socket.IO] Error terminating WebSocket for ${requestId}: ${terminateError.message}`);
          }
        }
      });
    } else {
      // Reject any other WebSocket connections
      console.warn(`[Server] Rejecting non-Socket.IO WebSocket upgrade for ${requestId}`);
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

// Add security, CORS, and NO-CACHE headers for ALL responses
// Skip header modifications for Socket.IO and Bare server requests to prevent conflicts
app.use((req, res, next) => {
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


// Universal asset proxy for proxied resources with debug logging and catch-all filtering (must be before static middleware and SPA fallback)
app.get('*', async (req, res, next) => {
  const assetPrefixes = ['/images/', '/logos/', '/xjs/', '/gen_204', '/search', '/favicon.ico', '/css/', '/js/', '/fonts/', '/static/'];
  const referer = req.headers.referer || '';
  const isProxiedReferer = referer.includes('/service/');
  if (isProxiedReferer && assetPrefixes.some(prefix => req.path.startsWith(prefix))) {
    console.log('Asset proxy HIT for:', req.path, 'referer:', referer);
    try {
      // Guess the base URL from the referer or default to https://www.google.com
      let baseUrl = 'https://www.google.com';
      if (req.headers.referer) {
        const match = req.headers.referer.match(/\/service\/([^/]+)/);
        if (match) {
          baseUrl = Buffer.from(match[1], 'base64').toString('utf-8');
          // Always use [www.google.com](www.google.com) for Google assets
          if (baseUrl.includes('google.com') && !baseUrl.includes('[www.google.com](www.google.com)')) {
            baseUrl = baseUrl.replace('://google.com', '://[www.google.com](www.google.com)');
          }
        }
      }
      // Build the full asset URL
      const assetUrl = baseUrl.replace(/\/$/, '') + req.path;
      const axios = require('axios');
      const proxyRes = await axios.post(
        'http://localhost:6078/proxy',
        { url: assetUrl, method: 'GET' },
        { responseType: 'arraybuffer', validateStatus: () => true }
      );
      // Forward content type and safe headers
      const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
      res.set('Content-Type', contentType);
      const safeHeaders = ['content-length','cache-control','expires','last-modified','etag'];
      for (const h of safeHeaders) {
        if (proxyRes.headers[h]) res.set(h, proxyRes.headers[h]);
      }
      res.status(proxyRes.status).send(Buffer.from(proxyRes.data));
    } catch (err) {
      res.status(502).send('Asset proxy error: ' + (err.message || err));
    }
    return;
  }
  next();
});

// Serve static assets (CSS, JS, images, etc.)
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/js', express.static(path.join(__dirname, 'js')));

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

// Visual proxy route for /service/:encodedUrl (must be before SPA fallback)
app.get('/service/:encodedUrl', async (req, res) => {

// Universal asset proxy for proxied resources with debug logging and catch-all filtering (must be before SPA fallback)
app.get('*', async (req, res, next) => {
  const assetPrefixes = ['/images/', '/logos/', '/xjs/', '/gen_204', '/search', '/favicon.ico', '/css/', '/js/', '/fonts/', '/static/'];
  if (assetPrefixes.some(prefix => req.path.startsWith(prefix))) {
    console.log('Asset proxy HIT for:', req.path);
    try {
      // Guess the base URL from the referer or default to https://www.google.com
      let baseUrl = 'https://www.google.com';
      if (req.headers.referer) {
        const match = req.headers.referer.match(/\/service\/([^/]+)/);
        if (match) {
          baseUrl = Buffer.from(match[1], 'base64').toString('utf-8');
          // Always use [www.google.com](www.google.com) for Google assets
          if (baseUrl.includes('google.com') && !baseUrl.includes('[www.google.com](www.google.com)')) {
            baseUrl = baseUrl.replace('://google.com', '://[www.google.com](www.google.com)');
          }
        }
      }
      // Build the full asset URL
      const assetUrl = baseUrl.replace(/\/$/, '') + req.path;
      const axios = require('axios');
      const proxyRes = await axios.post(
        'http://localhost:6078/proxy',
        { url: assetUrl, method: 'GET' },
        { responseType: 'arraybuffer', validateStatus: () => true }
      );
      // Forward content type and safe headers
      const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
      res.set('Content-Type', contentType);
      const safeHeaders = ['content-length','cache-control','expires','last-modified','etag'];
      for (const h of safeHeaders) {
        if (proxyRes.headers[h]) res.set(h, proxyRes.headers[h]);
      }
      res.status(proxyRes.status).send(Buffer.from(proxyRes.data));
    } catch (err) {
      res.status(502).send('Asset proxy error: ' + (err.message || err));
    }
    return;
  }
  next();
});

  const encodedUrl = req.params.encodedUrl;
  if (!encodedUrl) {
    return res.status(400).send('Missing encoded URL');
  }
  try {
    // Decode the URL
    const url = Buffer.from(encodedUrl, 'base64').toString('utf-8');
    // Forward the request to the Python proxy
    const axios = require('axios');
    const proxyRes = await axios.post(
      'http://localhost:6078/proxy',
      { url, method: 'GET' },
      { responseType: 'arraybuffer', validateStatus: () => true }
    );

    // Try to parse as JSON
    let isJson = false;
    let json = null;
    try {
      const text = Buffer.from(proxyRes.data).toString('utf8');
      json = JSON.parse(text);
      isJson = json && typeof json === 'object' && 'body' in json;
    } catch (e) {}

    if (isJson) {
      // If the proxy returned JSON with a 'body', send the body as HTML
      res.set('Content-Type', 'text/html');
      res.status(json.status || 200).send(json.body);
    } else {
      // Otherwise, forward the proxied response as-is
      const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
      res.set('Content-Type', contentType);
      const safeHeaders = ['content-length','cache-control','expires','last-modified','etag'];
      for (const h of safeHeaders) {
        if (proxyRes.headers[h]) res.set(h, proxyRes.headers[h]);
      }
      res.status(proxyRes.status).send(Buffer.from(proxyRes.data));
    }
  } catch (err) {
    res.status(502).send('Proxy error: ' + (err.message || err));
  }
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