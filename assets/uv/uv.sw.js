/**
 * UV Service Worker
 * This handles the proxy requests and caching
 */

console.log('[UV SW] Worker loading');

// Safely import scripts with error handling
function safeImport(url) {
  try {
    self.importScripts(url);
    console.log(`[UV SW] Successfully imported: ${url}`);
    return true;
  } catch (error) {
    console.error(`[UV SW] Failed to import: ${url}`, error);
    return false;
  }
}

// Service worker URL base - detect dynamically
const swLocation = self.location.pathname;
const basePath = swLocation.substring(0, swLocation.lastIndexOf('/') + 1);
console.log(`[UV SW] Base path detected as: ${basePath}`);

// List of required scripts with absolute and relative paths for fallback
const scripts = [
  { name: 'uv.bundle.js', paths: [`${basePath}uv.bundle.js`, '/assets/uv/uv.bundle.js'] },
  { name: 'uv.config.js', paths: [`${basePath}uv.config.js`, '/assets/uv/uv.config.js'] },
  { name: 'bare.js', paths: [`${basePath}bare.js`, '/assets/uv/bare.js'] }
];

// Try importing each script with fallbacks
let importSuccess = true;
for (const script of scripts) {
  let imported = false;
  
  // Try each possible path
  for (const path of script.paths) {
    if (safeImport(path)) {
      imported = true;
      break;
    }
  }
  
  // If we couldn't import this script at all, log an error
  if (!imported) {
    console.error(`[UV SW] Critical: Could not import ${script.name} from any path`);
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ 
          type: 'uv-error', 
          message: `Failed to load required script: ${script.name}` 
        });
      });
    });
    importSuccess = false;
  }
  
  // If all paths failed, mark overall success as false
  if (!imported) {
    console.error(`[UV SW] Could not import ${script.name} from any path`);
    importSuccess = false;
  }
}

// Log overall import status
if (importSuccess) {
  console.log('[UV SW] All scripts imported successfully');
} else {
  console.error('[UV SW] Some scripts failed to import, service worker may not function correctly');
}

try {
  // Create ultraviolet instance
  const ultraviolet = new UVServiceWorker();
  console.log('[UV SW] Created UV worker instance');
  
  // Register bare client for proxy server communication
  self.bareClient = new BareClient('/bare-server/');
  console.log('[UV SW] Registered BareClient with server: /bare-server/');
  
  // Process bare server responses to handle CORS
  function processBareResponse(response) {
    // Skip processing if response is null
    if (!response) {
      console.warn('[UV SW] Received null response');
      return new Response('', { status: 500 });
    }
    
    console.log(`[UV SW] Processing response: status=${response.status}, type=${response.type}`);
    
    // Handle CORS issues with opaque responses by creating a new response
    if (response.type === 'opaque' || response.type === 'error') {
      console.warn('[UV SW] Handling opaque/error response type');
      
      try {
        // Create new headers with CORS allowed
        const headers = new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        });
        
        // Try to get the content type from the original response
        if (response.headers && response.headers.get('content-type')) {
          headers.set('Content-Type', response.headers.get('content-type'));
        } else {
          // Default content type
          headers.set('Content-Type', 'text/html');
        }
        
        // Try to read the response body
        return response.blob()
          .then(blob => new Response(blob, {
            status: response.status,
            statusText: response.statusText,
            headers: headers
          }))
          .catch(err => {
            console.error('[UV SW] Error reading response body:', err);
            return new Response('Error processing response', { 
              status: 500,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      } catch (err) {
        console.error('[UV SW] Error processing response:', err);
        return new Response('Error processing response: ' + err.message, { 
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }
    
    return response;
  }
  
  // Debug errors in fetch events
  self.addEventListener('error', (event) => {
    console.error('[UV SW] Service Worker error:', event.error);
  });
  
  // Activate immediately
  self.addEventListener('install', (event) => {
    console.log('[UV SW] Service worker installed');
    event.waitUntil(self.skipWaiting());
  });
  
  self.addEventListener('activate', (event) => {
    console.log('[UV SW] Service worker activated');
    event.waitUntil(self.clients.claim());
  });
  
  // Fetch handler for all requests
  self.addEventListener('fetch', (event) => {
    // Check if this request should be handled by Ultraviolet
    if (event.request.url.startsWith(location.origin + __uv$config.prefix)) {
      console.log('[UV SW] Handling request:', event.request.url);
      
      event.respondWith(
        (async () => {
          try {
            // Try to extract the target URL from the request
            const targetURL = event.request.url.split(__uv$config.prefix)[1];
            if (!targetURL) {
              console.error('[UV SW] Invalid request format, missing target URL');
              return new Response('Invalid proxy request format', { status: 400 });
            }
            
            console.log('[UV SW] Processing proxy request for:', targetURL);
            
            // Create a new request with proper headers
            const headers = new Headers(event.request.headers);
            
            // Add a header to identify this request as coming from the service worker
            headers.set('Service-Worker', 'script');
            headers.set('X-UV-Service-Worker', 'true');
            headers.set('X-Bare-Is-Proxy-Request', 'true');
            
            // Clone the request but with the new headers
            const modifiedRequest = new Request(event.request.url, {
              method: event.request.method,
              headers: headers,
              body: event.request.method !== 'GET' && event.request.method !== 'HEAD' ? await event.request.clone().blob() : undefined,
              mode: 'cors',
              credentials: 'omit',
              redirect: 'follow'
            });
            
            // Attempt to fetch the resource using Ultraviolet
            const response = await ultraviolet.fetch({
              request: modifiedRequest,
              // Make the original event available if needed
              event: event
            });
            
            // Check if the response is valid
            if (!response) {
              console.error('[UV SW] Empty response from UV fetch');
              return new Response('Empty response from proxy', { 
                status: 502,
                headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }
              });
            }
            
            console.log(`[UV SW] Got response: status=${response.status}, type=${response.type}`);
            
            // Process the response to handle CORS issues
            if (typeof processBareResponse === 'function') {
              return await processBareResponse(response);
            }
            
            // If response is of type 'error' or status is 0, it's likely an opaque response
            if (response.type === 'error' || response.type === 'opaque' || response.status === 0) {
              console.warn('[UV SW] Received opaque/error response, attempting to fix');
              
              // Create a new response with CORS headers
              const headers = new Headers();
              headers.set('Access-Control-Allow-Origin', '*');
              headers.set('Content-Type', 'text/html');
              
              // Try to get the body if possible
              let body;
              try {
                body = await response.clone().text();
              } catch (e) {
                console.error('[UV SW] Could not read response body:', e);
                body = null;
              }
              
              return new Response(body, {
                status: response.status || 200,
                headers: headers
              });
            }
            
            return response;
          } catch (err) {
            console.error('[UV SW] Error in fetch handler:', err);
            return new Response('Proxy error: ' + err.message, { 
              status: 500,
              headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
        })()
      );
    } else {
      // Pass through non-UV requests
      console.log('[UV SW] Passing through request:', event.request.url);
    }
  });
  
  console.log('[UV SW] Service worker initialized successfully');
} catch (err) {
  console.error('[UV SW] Failed to initialize service worker:', err);
} 