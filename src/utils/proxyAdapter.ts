// Proxy Adapter (converted from legacy proxy-adapter.js)
// This module provides functions to integrate the Python proxy client and override proxy-related globals in a React/TypeScript app.
// NOTE: Integration with window and serviceWorker should be called from a useEffect or app initializer in React.

import pythonProxyClient from './pythonProxyClient';

export function initializeProxyAdapter() {
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
  (window as any).redirectToProxy = function(url: string) {
    console.log('Redirecting to Python proxy for URL:', url);
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    const encodedUrl = btoa(url);
    window.location.href = `/service/${encodedUrl}`;
  };

  // Override the BareClient class if it doesn't exist
  if (typeof (window as any).BareClient === 'undefined') {
    (window as any).BareClient = class BareClient {
      server: string;
      constructor(server: string) {
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
  (window as any).bareClient = new (window as any).BareClient('/proxy');

  // Override the service worker registration to prevent errors
  if ('serviceWorker' in navigator) {
    const originalRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = function(scriptURL: string, options?: RegistrationOptions) {
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
        } as unknown as ServiceWorkerRegistration);
      }
      // Otherwise, proceed with the original registration
      return originalRegister.call(navigator.serviceWorker, scriptURL, options);
    };
  }

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
      } catch (error: any) {
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
}

// NOTE: To use in React, call initializeProxyAdapter() once in your App or a top-level provider.
