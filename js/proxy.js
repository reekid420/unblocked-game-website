/**
 * UV Proxy functionality
 */
import { sanitizeInput, isUrl } from './utils.js';

/**
 * Initialize the proxy form handling
 */
function initializeProxy() {
  const form = document.getElementById('uv-form');
  
  if (form) {
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      
      const address = document.getElementById('uv-address');
      const searchEngine = document.getElementById('uv-search-engine');
      
      if (!address || !searchEngine) {
        console.error('Proxy form elements not found');
        return;
      }
      
      // Sanitize input
      const sanitizedValue = sanitizeInput(address.value);
      
      if (!sanitizedValue) {
        alert('Please enter a URL or search term');
        return;
      }
      
      // Process the query
      processQuery(sanitizedValue, searchEngine.value);
    });
  }
}

/**
 * Process search query or URL
 * @param {string} query - User input (URL or search term)
 * @param {string} searchEngine - Search engine URL template
 */
function processQuery(query, searchEngine) {
  let url = query.trim();
  
  if (!isUrl(url)) {
    // If it's a search term, use the search engine
    const sanitizedSearchQuery = encodeURIComponent(url);
    url = searchEngine + sanitizedSearchQuery;
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Add https if the URL doesn't include protocol
    url = 'https://' + url;
  }
  
  // Redirect through UV proxy
  redirectToProxy(url);
}

/**
 * Redirect to the URL through the UV proxy
 * @param {string} url - The URL to access through the proxy
 */
function redirectToProxy(url) {
  try {
    // In a real implementation, this would use the actual UV encoding
    // This is a simplified version for demonstration
    const encodedUrl = btoa(url);
    const proxyUrl = `/service/${encodedUrl}`;
    
    // Log the proxied URL (in a real app, this would be sent to the server)
    console.log('Proxying URL:', url);
    
    // Redirect to the proxied URL
    window.location.href = proxyUrl;
  } catch (err) {
    console.error('Failed to proxy URL:', err);
    alert('Failed to access the URL through the proxy');
  }
}

/**
 * Register the UV service worker
 * This handles proxy requests
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    const swScript = '/assets/uv/uv.sw.js';
    
    navigator.serviceWorker.register(swScript, {
      scope: '/service/'
    }).then(() => {
      console.log('UV service worker registered');
    }).catch(err => {
      console.error('Failed to register UV service worker:', err);
    });
  } else {
    console.warn('Service workers are not supported in this browser');
  }
}

// Initialize proxy functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Register service worker
  registerServiceWorker();
  
  // Initialize proxy form
  initializeProxy();
});

export { initializeProxy, processQuery, redirectToProxy }; 