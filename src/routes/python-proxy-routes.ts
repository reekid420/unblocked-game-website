import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import axios from 'axios';
// If you see a type error, install @types/jsonwebtoken
import jwt from 'jsonwebtoken';

// Extend Express Request to include proxyToken
interface ProxyRequest extends Request {
  proxyToken?: string;
}

// Python Proxy Configuration
const PYTHON_PROXY_URL = process.env.PYTHON_PROXY_URL || 'http://localhost:6078';
const PYTHON_PROXY_ENABLED = process.env.PYTHON_PROXY_ENABLED === 'true';

// Logger for Python proxy
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[PythonProxy] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[PythonProxy] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[PythonProxy] ${message}`, ...args)
};

// Middleware to check if Python proxy is enabled
const checkProxyEnabled = (req: Request, res: Response, next: NextFunction): void => {
  if (!PYTHON_PROXY_ENABLED) {
    res.status(503).json({
      error: 'Python proxy is not enabled',
      message: 'The Python proxy service is currently disabled'
    });
    return;
  }
  next();
};

// Middleware to add authentication token to requests
const addAuthToken = (req: ProxyRequest, res: Response, next: NextFunction): void => {
  // Get user ID from session or default to anonymous
  const userId = (req.session as any)?.userId || 'anonymous';
  // Create a JWT token for the Python proxy
  const token = jwt.sign(
    { userId, role: 'user' },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '1h' }
  );
  req.proxyToken = token;
  next();
};

const router = express.Router();

// Enhanced health check route for the Python proxy and Node.js integration
router.get('/health', checkProxyEnabled, async (req: Request, res: Response): Promise<void> => {
  let responded = false;
  try {
    // Fetch health from Python FastAPI backend
    const pythonHealth = await axios.get(`${PYTHON_PROXY_URL}/health`);
    // Fetch metrics from Python FastAPI backend
    let pythonMetrics = null;
    try {
      const metricsResp = await axios.get(`${PYTHON_PROXY_URL}/ai/metrics`);
      pythonMetrics = metricsResp.data;
    } catch (metricsErr: any) {
      logger.warn('Could not fetch Python AI metrics:', metricsErr.message);
    }

    // Compose detailed health status
    const nodeHealth = {
      status: 'healthy',
      nodeTime: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      uptimeSeconds: process.uptime(),
      env: process.env.NODE_ENV || 'development',
      version: process.version
    };

    const healthReport = {
      status: pythonHealth.data.status === 'healthy' ? 'healthy' : 'degraded',
      node: nodeHealth,
      python: pythonHealth.data,
      pythonMetrics: pythonMetrics || 'unavailable',
      lastChecked: new Date().toISOString()
    };

    if (!res.headersSent && !responded) {
      responded = true;
      res.status(200).json(healthReport);
    }
  } catch (error: any) {
    logger.error('Health check failed:', error.message);
    if (!res.headersSent && !responded) {
      responded = true;
      res.status(500).json({
        error: 'Health check failed',
        message: error.message,
        nodeTime: new Date().toISOString(),
        nodeStatus: 'unhealthy'
      });
    }
  }
});

// Proxy route for web requests
router.post('/proxy', checkProxyEnabled, addAuthToken, async (req: ProxyRequest, res: Response): Promise<void> => {
  const { url, method = 'GET', headers = {}, body } = req.body;
  if (!url) {
    res.status(400).json({
      error: 'Missing URL',
      message: 'URL is required for proxy requests'
    });
    return;
  }
  try {
    const proxyHeaders = { ...headers, Authorization: `Bearer ${req.proxyToken}` };
    const response = await axios({
      url: `${PYTHON_PROXY_URL}/proxy`,
      method,
      headers: proxyHeaders,
      data: body,
      responseType: 'arraybuffer',
      validateStatus: () => true
    });
    res.status(response.status).set(response.headers).send(response.data);
  } catch (error: any) {
    logger.error('Proxy request failed:', error.message);
    res.status(502).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
});

// Example: Topics route (more routes can be added similarly)
router.get('/topics', checkProxyEnabled, addAuthToken, async (req: ProxyRequest, res: Response): Promise<void> => {
  try {
    const response = await axios.get(
      `${PYTHON_PROXY_URL}/api/topics`,
      { headers: { Authorization: `Bearer ${req.proxyToken}` } }
    );
    res.status(response.status).json(response.data);
  } catch (error: any) {
    logger.error('Topics request failed:', error.message);
    res.status(502).json({
      error: 'Topics request failed',
      message: error.message
    });
  }
});

export default router;
