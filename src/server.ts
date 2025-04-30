// Converted from legacy server.js to TypeScript with minimal change
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import session from 'express-session';
import cookieParser from 'cookie-parser';

// Load environment variables
dotenv.config();

// --- App and Server Initialization ---
const app = express();


const port = Number(process.env.PORT) || 8080;
const server = http.createServer(app);

// --- Socket.io Setup ---
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  path: '/socket.io/',
  serveClient: true,
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  upgradeTimeout: 10000,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 5e6,
  destroyUpgrade: false,
  cookie: {
    name: 'io',
    path: '/',
    httpOnly: true,
    sameSite: 'lax'
  }
});

// Import Socket.io initialization
// @ts-ignore
import { initSocketServer } from './socket/chat-socket.ts';
initSocketServer(io);

const PYTHON_PROXY_URL = process.env.PYTHON_PROXY_URL || 'http://localhost:6078';
const PYTHON_PROXY_ENABLED = process.env.PYTHON_PROXY_ENABLED === 'true';

// Logger for Python proxy
const pythonProxyLogger = {
  info: (...args: any[]) => console.info('[PYTHON PROXY]', ...args),
  warn: (...args: any[]) => console.warn('[PYTHON PROXY]', ...args),
  error: (...args: any[]) => console.error('[PYTHON PROXY]', ...args),
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
// @ts-ignore
import pythonProxyRoutes from './routes/python-proxy-routes.ts';
app.use('/proxy', pythonProxyRoutes);

// --- Mount AI Routes ---
// @ts-ignore
import aiRoutes from './routes/ai-routes.ts';
app.use('/api/ai-chat', aiRoutes);

// --- Static Middleware (after proxy logic) ---


app.all('*', (req, res, next) => {
  // If the request looks like a static asset (has a file extension) and no static middleware handled it, return 404
  if (/\.[a-zA-Z0-9]{2,5}(\?|$)/.test(req.url)) {
    res.status(404).send('Not Found');
    return;
  }
  next();
});

// --- Asset Proxy for Proxied Pages ---
app.get('*', (req, res, next) => {
  const assetPrefixes = ['/images/', '/logos/', '/xjs/', '/gen_204', '/search', '/favicon.ico', '/css/', '/js/', '/fonts/', '/static/'];
  const referer = req.headers.referer || '';
  const isProxiedReferer = referer.includes('/service/');
  if (isProxiedReferer && assetPrefixes.some(prefix => req.path.startsWith(prefix))) {
    console.log('Asset proxy HIT for:', req.path, 'referer:', referer);
    (async () => {
      try {
        let baseUrl = 'https://www.google.com';
        if (req.headers.referer) {
          const match = req.headers.referer.match(/\/service\/([^/]+)/);
          if (match) {
            baseUrl = Buffer.from(match[1], 'base64').toString('utf-8');
            if (baseUrl.includes('google.com') && !baseUrl.includes('www.google.com')) {
              baseUrl = baseUrl.replace('://google.com', '://www.google.com');
            }
          }
        }
        const assetUrl = baseUrl.replace(/\/$/, '') + req.path;
        const proxyRes = await axios.post(
          'http://localhost:' + port + '/proxy/proxy',
          { url: assetUrl, method: 'GET' },
          { responseType: 'arraybuffer', validateStatus: () => true }
        );
        const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
        res.set('Content-Type', contentType);
        const safeHeaders = ['content-length','cache-control','expires','last-modified','etag'];
        for (const h of safeHeaders) {
          if (proxyRes.headers[h]) res.set(h, proxyRes.headers[h]);
        }
        res.status(proxyRes.status).send(Buffer.from(proxyRes.data));
      } catch (err: any) {
        res.status(502).send('Asset proxy error: ' + (err.message || err));
      }
    })();
    return;
  }
  next();
});

// --- Visual Proxy for /service/:encodedUrl ---
app.get('/service/:encodedUrl', (req, res) => {
  const encodedUrl = req.params.encodedUrl;
  if (!encodedUrl) {
    return res.status(400).send('Missing encoded URL');
  }
  (async () => {
    try {
      const url = Buffer.from(encodedUrl, 'base64').toString('utf-8');
      const proxyRes = await axios.post(
        'http://localhost:' + port + '/proxy/proxy',
        { url, method: 'GET' },
        { responseType: 'arraybuffer', validateStatus: () => true }
      );
      let isJson = false;
      let json: any = null;
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
    } catch (err: any) {
      res.status(502).send('Proxy error: ' + (err.message || err));
    }
  })();
});

// --- Health Check ---
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// --- SPA Fallback ---
app.get('*', (req, res, next) => {
  // @ts-ignore
  if (req.__handled || res.headersSent) return next();
  const url = req.url;
  // Skip fallback for known server routes
  if (
    url.startsWith('/assets/') ||
    url.startsWith('/api/') ||
    url.startsWith('/proxy') ||
    url.startsWith('/chat') ||
    url.startsWith('/register') ||
    url.startsWith('/login') ||
    url.startsWith('/profile') ||
    url.startsWith('/socket.io')
  ) return next();
  // Skip fallback for static asset requests (has a file extension)
  if (/\.[a-zA-Z0-9]{2,5}(\?|$)/.test(url)) return next();
  if (url.includes('wp-admin') || url.includes('wordpress')) {
    return res.sendFile(path.join(__dirname, '../index.html'));
  }
  console.log(`Serving index.html for route: ${url}`);
  return res.sendFile(path.join(__dirname, '../index.html'));
});

// --- HTTP and WebSocket Handlers ---




// Add security, CORS, and NO-CACHE headers for ALL responses
app.use((req, res, next) => {
  if (!(req as any).isSocketIoRequest && !(req as any).__socketio && !(req as any).isBareRequest) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('Referrer-Policy', 'no-referrer-when-downgrade');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    res.header('Surrogate-Control', 'no-store');
    res.header('ETag', `"${Date.now()}-${Math.random().toString(36).substring(2, 15)}"`);
    // res.header('Clear-Site-Data', '"cache"');
  }
  next();
});

// Enhanced error middleware
app.use((err: any, req: any, res: any, next: any) => {
  if (res.headersSent) {
    console.warn(`Attempted to set headers after they were sent to the client: ${req.url}`);
    console.warn(`Error: ${err ? err.message : 'Unknown'}`);
    return next(err);
  }
  next(err);
});



// Universal asset proxy for proxied resources (already handled above, skip duplicate)
// Static asset serving (already handled above, skip duplicate)

// Import and mount API routes
// @ts-ignore - keep require for now if routes are not migrated to TypeScript
import apiRoutes from './routes/index.ts';
app.use('/api', apiRoutes);

// Health check route (already handled above, skip duplicate)
// Bare server API info endpoint


// Redirect old /bare/ paths to /bare-info/ for compatibility


// Import fs for file existence checks
import fs from 'fs';

// Serve HTML files directly if they exist at root level
app.get('*.html', (req, res, next) => {
  if ((req as any).__handled || res.headersSent) {
    return next();
  }
  const url = req.url;
  if (url.startsWith('/assets/') ||
      url.startsWith('/api/') ||
      url.startsWith('/socket.io')) {
    return next();
  }
  const htmlFile = path.basename(url);
  const htmlPath = path.join(__dirname, htmlFile);
  if (fs.existsSync(htmlPath)) {
    return res.sendFile(htmlPath);
  }
  next();
});

// Handle specific static files
app.get('/favicon.ico', (_req, res) => {
  return res.sendFile(path.join(__dirname, 'assets', 'favicon.ico')); // _req intentionally unused
});

// (Python proxy variant) Visual proxy and asset proxy routes are already handled above for /service/:encodedUrl and assets

// SPA fallback (already handled above)

// WebSocket upgrade handler for bare server (skip Socket.IO upgrades)




// Start the server with clear IPv4 binding
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}/`);
});

export default app;
