/**
 * Ultraviolet Bundle - Mock Implementation
 * 
 * Note: This is a mock implementation for demonstration purposes.
 * In a real application, you would use the actual Ultraviolet bundle from:
 * https://github.com/titaniumnetwork-dev/Ultraviolet
 */

// Import bare client if needed
const bareClient = self.bareClient || {};

// Mock UVServiceWorker class for demonstration
class UVServiceWorker {
  constructor() {
    console.log('[UV] Service Worker constructed');
    this.config = self.__uv$config || {};
    this.isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');
    
    if (this.config) {
      console.log(`[UV] Initialized with config - prefix: ${this.config.prefix}, bare: ${this.config.bare}`);
    } else {
      console.warn('[UV] No config found during initialization');
    }
  }

  /**
   * Handle a proxy fetch request
   * @param {FetchEvent|Object} eventOrParams - Either a fetch event or an object with request
   * @returns {Promise<Response>} - The proxied response
   */
  async fetch(eventOrParams) {
    try {
      // Determine if this is an event or a parameters object
      const event = eventOrParams.event || eventOrParams;
      const request = eventOrParams.request || (event.request ? event.request : null);
      
      if (!request) {
        console.error('[UV] No request found in event or params');
        throw new Error('No request found in event or params');
      }
      
      // Determine the URL to proxy
      const url = request.url;
      
      // Get the encoded URL from the path
      const prefix = this.config.prefix || '/service/';
      const proxyPath = url.split(prefix)[1];
      
      if (!proxyPath) {
        console.error('[UV] Invalid proxy path');
        throw new Error('Invalid proxy path');
      }
      
      // Decode the URL
      let decodedUrl;
      try {
        decodedUrl = this.config.decodeUrl(proxyPath);
      } catch (err) {
        console.error('[UV] Error decoding URL:', err);
        throw new Error('Unable to decode URL: ' + err.message);
      }
      
      console.log('[UV] Handling request:', url);
      console.log('[UV] Proxying URL:', decodedUrl);
      
      // Use the bare client if available
      if (self.bareClient && typeof self.bareClient.fetch === 'function') {
        return self.bareClient.fetch(decodedUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          cache: request.cache,
          redirect: request.redirect
        });
      }
      
      // Fallback to manual bare server implementation
      console.log('[UV] Falling back to manual bare server implementation');
      
      // Parse the URL to get components
      let parsedUrl;
      try {
        parsedUrl = new URL(decodedUrl);
      } catch (error) {
        console.error('[UV] Invalid URL:', error);
        return new Response('Invalid URL: ' + error.message, { status: 400 });
      }
      
      // Create a request to the bare server instead of direct fetch
      const bareUrl = new URL('/bare-server/', self.location.origin);
      
      // Create headers for the bare server
      const bareHeaders = new Headers();
      bareHeaders.set('X-Bare-Host', parsedUrl.hostname);
      bareHeaders.set('X-Bare-Protocol', parsedUrl.protocol.replace(':', ''));
      bareHeaders.set('X-Bare-Path', parsedUrl.pathname + parsedUrl.search);
      bareHeaders.set('X-Bare-Port', parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80'));
      bareHeaders.set('X-Bare-Is-Proxy-Request', 'true');
      
      // Add original request headers
      const headers = {};
      for (const [key, value] of request.headers.entries()) {
        headers[key.toLowerCase()] = value;
      }
      
      // Add some important headers for compatibility
      if (!headers.origin) headers.origin = parsedUrl.origin;
      if (!headers.referer) headers.referer = parsedUrl.href;
      if (!headers['user-agent']) headers['user-agent'] = 'Mozilla/5.0';
      
      bareHeaders.set('X-Bare-Headers', JSON.stringify(headers));
      bareHeaders.set('X-Bare-Method', request.method);
      bareHeaders.set('X-Bare-Client-Version', '1.0.0');
      bareHeaders.set('X-Bare-Client-Browser', this.isFirefox ? 'firefox' : 'chrome');
      
      // Firefox specific headers
      if (this.isFirefox) {
        console.log('[UV] Adding Firefox-specific headers');
        bareHeaders.set('X-Bare-Forward-Headers', JSON.stringify([
          'accept',
          'accept-language',
          'user-agent'
        ]));
      }
      
      // Use mode that works best across browsers
      const requestInit = {
        method: request.method === 'GET' ? 'GET' : 'POST',
        headers: bareHeaders,
        mode: 'cors',
        credentials: 'omit',
        cache: request.cache,
        redirect: request.redirect
      };
      
      // Add body for non-GET requests
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          requestInit.body = await request.clone().text();
        } catch (error) {
          console.warn('[UV] Could not clone request body:', error);
        }
      }
      
      console.log('[UV] Sending request to bare server:', bareUrl.toString());
      console.log(`[UV] Request method: ${requestInit.method}, Headers:`, Object.fromEntries(bareHeaders.entries()));
      
      // Fetch through the bare server
      try {
        const proxyResponse = await fetch(bareUrl, requestInit);
        
        console.log(`[UV] Bare server response: ${proxyResponse.status} ${proxyResponse.statusText}`);
        
        if (!proxyResponse.ok && this.config.debug) {
          // Try to get error details
          try {
            const errorText = await proxyResponse.clone().text();
            console.error('[UV] Bare server error details:', errorText);
          } catch (e) {
            console.error('[UV] Could not read error details:', e);
          }
        }
        
        return proxyResponse;
      } catch (fetchError) {
        console.error('[UV] Fetch to bare server failed:', fetchError);
        return new Response('Proxy server error: ' + fetchError.message, { status: 502 });
      }
    } catch (err) {
      console.error('[UV] Error in UV fetch:', err);
      return new Response('UV proxy error: ' + err.message, {
        status: 500,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }
  }
}

// Mock UV client class for browser usage
class UVClient {
  constructor() {
    this.config = self.__uv$config || {};
    this.isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');
    
    console.log('[UV] Client initialized', this.isFirefox ? 'for Firefox' : '');
    if (this.config) {
      console.log(`[UV] Client config - prefix: ${this.config.prefix}`);
    }
  }
  
  /**
   * Encode a URL for proxying
   * @param {string} url - The URL to encode
   * @returns {string} - The encoded URL
   */
  encode(url) {
    // Normalize URL format
    if (!url.startsWith('http:') && !url.startsWith('https:')) {
      url = 'https://' + url;
    }
    
    console.log(`[UV] Encoding URL: ${url}`);
    
    if (!this.config.encodeUrl) {
      console.error('[UV] No encodeUrl function in config');
      throw new Error('UV configuration error: encodeUrl function not found');
    }
    
    try {
      const encoded = this.config.encodeUrl(url);
      console.log(`[UV] Encoded URL: ${encoded}`);
      return encoded;
    } catch (error) {
      console.error('[UV] Error encoding URL:', error);
      throw error;
    }
  }
  
  /**
   * Decode a proxied URL
   * @param {string} encodedUrl - The encoded URL
   * @returns {string} - The original URL
   */
  decode(encodedUrl) {
    console.log(`[UV] Decoding URL: ${encodedUrl}`);
    
    if (!this.config.decodeUrl) {
      console.error('[UV] No decodeUrl function in config');
      throw new Error('UV configuration error: decodeUrl function not found');
    }
    
    try {
      const decoded = this.config.decodeUrl(encodedUrl);
      console.log(`[UV] Decoded URL: ${decoded}`);
      return decoded;
    } catch (error) {
      console.error('[UV] Error decoding URL:', error);
      throw error;
    }
  }
}

// Make UV available globally
self.UVServiceWorker = UVServiceWorker;
self.UVClient = UVClient;
self.Ultraviolet = UVClient;

// Initialize UV if in browser context
if (typeof window !== 'undefined') {
  window.uv = window.uv || new UVClient();
  console.log('[UV] Client initialized in browser context');
  
  // Add a method to validate proxy setup
  window.uv.validateSetup = function() {
    const validation = {
      config: !!window.__uv$config,
      configPrefix: window.__uv$config ? window.__uv$config.prefix : null,
      configBare: window.__uv$config ? window.__uv$config.bare : null,
      serviceWorker: 'serviceWorker' in navigator,
      serviceWorkerRegistered: false,
      bareServerReachable: false
    };
    
    // Check if service worker is registered
    if (validation.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        const uvWorker = registrations.find(r => 
          r.scope && r.scope.includes(validation.configPrefix || '/service/')
        );
        validation.serviceWorkerRegistered = !!uvWorker;
        console.log('[UV] Service worker registration check:', validation.serviceWorkerRegistered);
      }).catch(err => {
        console.error('[UV] Error checking service worker registrations:', err);
      });
    }
    
    // Check if bare server is reachable
    if (window.bareClient && validation.configBare) {
      window.bareClient.ping()
        .then(data => {
          validation.bareServerReachable = true;
          console.log('[UV] Bare server reached successfully:', data);
        })
        .catch(err => {
          console.error('[UV] Bare server check failed:', err);
        });
    }
    
    console.log('[UV] Setup validation:', validation);
    return validation;
  };
  
  // Validate setup on load
  window.addEventListener('load', () => {
    setTimeout(() => {
      try {
        window.uv.validateSetup();
      } catch (e) {
        console.error('[UV] Validation error:', e);
      }
    }, 1000);
  });
} 