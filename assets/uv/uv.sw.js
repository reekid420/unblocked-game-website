/**
 * UV Service Worker
 * This handles the proxy requests and caching
 */

// Import required modules from the UV bundle
importScripts('/assets/uv/uv.bundle.js');
importScripts('/assets/uv/uv.config.js');

// Create a new UV instance with the configuration
const ultraviolet = new UVServiceWorker();

// Initialize cache
self.addEventListener('install', (event) => {
  console.log('UV Service Worker installed');
  self.skipWaiting();
});

// Activate and claim clients
self.addEventListener('activate', (event) => {
  console.log('UV Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Fetch handler for all requests
self.addEventListener('fetch', (event) => {
  // Check if this request should be handled by Ultraviolet
  if (event.request.url.startsWith(location.origin + __uv$config.prefix)) {
    console.log('UV handling request:', event.request.url);
    event.respondWith(
      ultraviolet.fetch(event)
        .catch(err => {
          console.error('UV fetch error:', err);
          return new Response('UV proxy error: ' + err.message, {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
  }
});

console.log('UV Service Worker initialized with prefix:', __uv$config.prefix); 