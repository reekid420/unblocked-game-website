/**
 * Proxy Adapter
 * Redirects Python proxy requests to the Python proxy
 */

import pythonProxyClient from './python-proxy-client.js';

// Initialize the Python proxy client
(async function() {
  try {
    await pythonProxyClient.initialize();
    console.log('Python proxy client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Python proxy client:', error);
  }
})();

// Override the redirectToProxy function to use Python proxy
window.redirectToProxy = function(url) {
  console.log('Redirecting to Python proxy for URL:', url);

  // If URL does not start with http:// or https://, prepend https://
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  // Encode the URL for the proxy
  const encodedUrl = btoa(url);

  // Redirect to the service worker path but using Python proxy
  window.location.href = `/service/${encodedUrl}`;
};

// Override the BareClient class if it doesn't exist
if (typeof window.BareClient === 'undefined') {
  window.BareClient = class BareClient {
    constructor(server) {
      this.server = server;
      console.log('Created BareClient with server:', server);
    }
    
    async ping() {
      try {
        const health = await pythonProxyClient.checkHealth();
        return { success: health.status === 'healthy' };
      } catch (error) {
        console.error('Bare ping failed:', error);
        throw error;
      }
    }
  };
}

// Create a global bareClient instance
window.bareClient = new window.BareClient('/proxy');

// Override the service worker registration to prevent errors
const originalRegister = navigator.serviceWorker.register;
navigator.serviceWorker.register = function(scriptURL, options) {
  console.log('Intercepted service worker registration for:', scriptURL);
  
  // If it's the UV service worker, return a mock registration
  if (scriptURL.includes('python-proxy-sw.js')) {
    console.log('Providing mock service worker registration for UV');
    
    return Promise.resolve({
      installing: null,
      waiting: null,
      active: {
        state: 'activated',
        addEventListener: () => {}
      },
      scope: options?.scope || '/service/',
      updateViaCache: options?.updateViaCache || 'none',
      onupdatefound: null,
      update: () => Promise.resolve(),
      unregister: () => Promise.resolve(true)
    });
  }
  
  // Otherwise, proceed with the original registration
  return originalRegister.call(navigator.serviceWorker, scriptURL, options);
};

// Handle service requests
if (window.location.pathname.startsWith('/service/')) {
  (async function() {
    try {
      // Extract the encoded URL from the path
      const encodedUrl = window.location.pathname.split('/service/')[1];
      if (!encodedUrl) {
        throw new Error('No URL provided');
      }
      
      // Decode the URL
      const url = atob(encodedUrl);
      console.log('Service worker intercepted request for:', url);
      
      // Create an iframe to display the proxied content
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.zIndex = '9999';
      
      // Set up a loading indicator
      const loadingDiv = document.createElement('div');
      loadingDiv.textContent = 'Loading...';
      loadingDiv.style.position = 'fixed';
      loadingDiv.style.top = '50%';
      loadingDiv.style.left = '50%';
      loadingDiv.style.transform = 'translate(-50%, -50%)';
      loadingDiv.style.padding = '20px';
      loadingDiv.style.background = 'rgba(0, 0, 0, 0.7)';
      loadingDiv.style.color = 'white';
      loadingDiv.style.borderRadius = '10px';
      loadingDiv.style.zIndex = '10000';
      
      // Add the loading indicator to the document
      document.body.appendChild(loadingDiv);
      
      // Use the Python proxy to fetch the content
      const response = await pythonProxyClient.proxyRequest(url);
      
      // Remove the loading indicator
      document.body.removeChild(loadingDiv);
      
      // If the response is HTML, create a data URL and load it in the iframe
      if (typeof response === 'string') {
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(response)}`;
        iframe.src = dataUrl;
      } else if (response instanceof Blob) {
        const dataUrl = URL.createObjectURL(response);
        iframe.src = dataUrl;
      } else {
        throw new Error('Unexpected response type');
      }
      
      // Add the iframe to the document
      document.body.innerHTML = '';
      document.body.appendChild(iframe);
      
    } catch (error) {
      console.error('Error handling service request:', error);
      document.body.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h1>Error</h1>
          <p>${error.message}</p>
          <button onclick="window.location.href='/'">Go Back</button>
        </div>
      `;
    }
  })();
}

console.log('Proxy adapter loaded successfully');
