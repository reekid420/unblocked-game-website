/**
 * Tests for Python proxy router functionality
 */

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock environment variables
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.API_KEY = 'test_api_key';
process.env.SERVICE_TOKEN = 'test_service_token';

// Import JWT for token generation
const jwt = require('jsonwebtoken');

describe('Proxy Router Functionality', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  describe('Bare Proxy Endpoint', () => {
    test('should proxy requests to target URL', async () => {
      // Mock successful response from proxy
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-Request-ID': 'req_12345'
        }),
        json: async () => ({
          data: 'Proxied content',
          status: 'success'
        })
      });

      // Target URL to proxy to
      const targetUrl = 'https://example.com/api/data';
      
      // Encode the URL for the proxy
      const encodedUrl = Buffer.from(targetUrl).toString('base64');

      // Make request to proxy endpoint
      const response = await fetch(`http://localhost:6078/bare-server/${encodedUrl}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Verify request was made correctly
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toBe(`http://localhost:6078/bare-server/${encodedUrl}`);
      expect(fetch.mock.calls[0][1].method).toBe('GET');
      
      // Verify response
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data).toBe('Proxied content');
      expect(responseBody.status).toBe('success');
    });

    test('should forward request headers and body to target', async () => {
      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      });

      // Target URL to proxy to
      const targetUrl = 'https://example.com/api/submit';
      
      // Encode the URL for the proxy
      const encodedUrl = Buffer.from(targetUrl).toString('base64');

      // Request data
      const requestData = {
        name: 'Test User',
        email: 'test@example.com'
      };

      // Custom headers
      const customHeaders = {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
        'User-Agent': 'Jest Test Client'
      };

      // Make POST request to proxy endpoint
      const response = await fetch(`http://localhost:6078/bare-server/${encodedUrl}`, {
        method: 'POST',
        headers: customHeaders,
        body: JSON.stringify(requestData)
      });

      // Verify request was made correctly
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][0]).toBe(`http://localhost:6078/bare-server/${encodedUrl}`);
      expect(fetch.mock.calls[0][1].method).toBe('POST');
      expect(fetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
      expect(fetch.mock.calls[0][1].headers['X-Custom-Header']).toBe('custom-value');
      expect(fetch.mock.calls[0][1].headers['User-Agent']).toBe('Jest Test Client');
      
      // Verify body was forwarded
      expect(fetch.mock.calls[0][1].body).toBe(JSON.stringify(requestData));
      
      // Verify response
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });

    test('should handle proxy errors gracefully', async () => {
      // Mock error response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Proxy Error',
          message: 'Failed to connect to target server',
          status_code: 500,
          request_id: 'req_12345'
        })
      });

      // Target URL to proxy to
      const targetUrl = 'https://nonexistent-server.example/api';
      
      // Encode the URL for the proxy
      const encodedUrl = Buffer.from(targetUrl).toString('base64');

      // Make request to proxy endpoint
      const response = await fetch(`http://localhost:6078/bare-server/${encodedUrl}`, {
        method: 'GET'
      });

      // Verify response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Proxy Error');
      expect(responseBody.message).toBe('Failed to connect to target server');
    });

    test('should handle timeouts', async () => {
      // Mock timeout response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: async () => ({
          error: 'Gateway Timeout',
          message: 'Request timed out after 30 seconds',
          status_code: 504,
          request_id: 'req_12345'
        })
      });

      // Target URL to proxy to
      const targetUrl = 'https://slow-server.example/api';
      
      // Encode the URL for the proxy
      const encodedUrl = Buffer.from(targetUrl).toString('base64');

      // Make request to proxy endpoint with timeout parameter
      const response = await fetch(`http://localhost:6078/bare-server/${encodedUrl}?timeout=30`, {
        method: 'GET'
      });

      // Verify response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(504);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Gateway Timeout');
      expect(responseBody.message).toBe('Request timed out after 30 seconds');
    });
  });

  describe('Proxy with Authentication', () => {
    test('should allow authenticated requests with user tracking', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { sub: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'Protected content' })
      });

      // Target URL to proxy to
      const targetUrl = 'https://example.com/api/protected';
      
      // Encode the URL for the proxy
      const encodedUrl = Buffer.from(targetUrl).toString('base64');

      // Make authenticated request to proxy endpoint
      const response = await fetch(`http://localhost:6078/bare-server/${encodedUrl}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      });

      // Verify request was made with authorization
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${validToken}`);
      
      // Verify response
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.data).toBe('Protected content');
    });

    test('should track rate limits for authenticated users', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        { sub: 'test_user', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Mock rate limit response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: 60,
          request_id: 'req_12345'
        })
      });

      // Target URL to proxy to
      const targetUrl = 'https://example.com/api/data';
      
      // Encode the URL for the proxy
      const encodedUrl = Buffer.from(targetUrl).toString('base64');

      // Make authenticated request to proxy endpoint
      const response = await fetch(`http://localhost:6078/bare-server/${encodedUrl}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      });

      // Verify response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Rate limit exceeded');
      expect(responseBody.retryAfter).toBe(60);
    });
  });

  describe('Proxy Metrics', () => {
    test('should return proxy metrics for service requests', async () => {
      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          total_requests: 1000,
          successful_requests: 950,
          failed_requests: 50,
          cached_responses: 200,
          average_response_time: 0.25,
          requests_per_minute: 16.7,
          success_rate: 95.0,
          cache_hit_rate: 20.0,
          timestamp: Date.now() / 1000
        })
      });

      // Make request to metrics endpoint with service token
      const response = await fetch('http://localhost:6078/bare-server/metrics', {
        method: 'GET',
        headers: {
          'X-Service-Token': process.env.SERVICE_TOKEN
        }
      });

      // Verify request was made with service token
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1].headers['X-Service-Token']).toBe(process.env.SERVICE_TOKEN);
      
      // Verify response
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.total_requests).toBe(1000);
      expect(responseBody.successful_requests).toBe(950);
      expect(responseBody.success_rate).toBe(95.0);
    });

    test('should reject metrics requests without service token', async () => {
      // Mock forbidden response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'Forbidden',
          message: 'Invalid service token'
        })
      });

      // Make request to metrics endpoint without service token
      const response = await fetch('http://localhost:6078/bare-server/metrics', {
        method: 'GET'
      });

      // Verify response
      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
      
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Forbidden');
      expect(responseBody.message).toBe('Invalid service token');
    });
  });

  describe('Proxy Caching', () => {
    test('should cache responses when enabled', async () => {
      // Target URL to proxy to
      const targetUrl = 'https://example.com/api/cacheable-data';
      
      // Encode the URL for the proxy
      const encodedUrl = Buffer.from(targetUrl).toString('base64');

      // Mock first response (cache miss)
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-Cache': 'MISS',
          'X-Request-ID': 'req_12345'
        }),
        json: async () => ({
          data: 'Cacheable content',
          timestamp: Date.now() / 1000
        })
      });

      // First request - should be a cache miss
      const firstResponse = await fetch(`http://localhost:6078/bare-server/${encodedUrl}?cache=true`, {
        method: 'GET'
      });

      // Verify first response
      expect(firstResponse.ok).toBe(true);
      const firstResponseBody = await firstResponse.json();
      expect(firstResponseBody.data).toBe('Cacheable content');
      
      // Mock second response (cache hit)
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Request-ID': 'req_12346'
        }),
        json: async () => ({
          data: 'Cacheable content',
          timestamp: Date.now() / 1000,
          cached: true
        })
      });

      // Second request - should be a cache hit
      const secondResponse = await fetch(`http://localhost:6078/bare-server/${encodedUrl}?cache=true`, {
        method: 'GET'
      });

      // Verify second response
      expect(secondResponse.ok).toBe(true);
      const secondResponseBody = await secondResponse.json();
      expect(secondResponseBody.data).toBe('Cacheable content');
      expect(secondResponseBody.cached).toBe(true);
      
      // Verify cache headers
      expect(secondResponse.headers.get('X-Cache')).toBe('HIT');
    });

    test('should bypass cache when requested', async () => {
      // Target URL to proxy to
      const targetUrl = 'https://example.com/api/data';
      
      // Encode the URL for the proxy
      const encodedUrl = Buffer.from(targetUrl).toString('base64');

      // Mock response (cache bypass)
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Type': 'application/json',
          'X-Cache': 'BYPASS',
          'X-Request-ID': 'req_12345'
        }),
        json: async () => ({
          data: 'Fresh content',
          timestamp: Date.now() / 1000
        })
      });

      // Request with cache bypass
      const response = await fetch(`http://localhost:6078/bare-server/${encodedUrl}?cache=false`, {
        method: 'GET'
      });

      // Verify response
      expect(response.ok).toBe(true);
      expect(response.headers.get('X-Cache')).toBe('BYPASS');
      
      const responseBody = await response.json();
      expect(responseBody.data).toBe('Fresh content');
    });
  });

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      // Mock successful response
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'healthy',
          timestamp: Date.now() / 1000,
          version: '1.0.0'
        })
      });

      // Make request to health endpoint
      const response = await fetch('http://localhost:6078/bare-server/health', {
        method: 'GET'
      });

      // Verify response
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.status).toBe('healthy');
    });
  });
});
