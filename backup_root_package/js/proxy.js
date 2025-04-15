/**
 * Python proxy functionality
 */
import { isUrl } from './utils.js';

// Track initialization state
let isInitialized = false;

// Detect browser environment
const browserInfo = {
  userAgent: navigator.userAgent,
  isFirefox: navigator.userAgent.includes('Firefox'),
  isChrome: navigator.userAgent.includes('Chrome'),
  isServiceWorkerSupported: 'serviceWorker' in navigator
};

// Custom logger with browser type
const logger = {
  info: (message, ...args) => console.log(`[Python Proxy] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[Python Proxy] ${message}`, ...args),
  error: (message, ...args) => console.error(`[Python Proxy] ${message}`, ...args)
};

/**
 * Initialize the proxy functionality
 */
function initializeProxy() {
  // Check if we're already initializing to prevent double initialization
  if (window.__pythonProxyInitializing) {
    logger.info('Proxy initialization already in progress, skipping duplicate call');
    return;
  }
  window.__pythonProxyInitializing = true;
  
  logger.info('Initializing proxy with browser:', browserInfo);
  
  const searchForm = document.getElementById('searchForm');
  
  if (searchForm) {
    searchForm.addEventListener('submit', function(event) {
      event.preventDefault();
      
      // Get the query from the search input
      const searchInput = document.getElementById('searchbar');
      const query = searchInput ? searchInput.value.trim() : '';
      
      if (!query) {
        alert('Please enter a URL or search query');
        return;
      }
      
      // Process the query (search or direct URL)
      const defaultSearchEngine = 'https://www.google.com/search?q=';
      processQuery(query, defaultSearchEngine);
    });
    
    logger.info('Search form handler registered');
  }
  
  // Check if we're already in a proxy context - if so don't re-register the service worker
  if (window.location.pathname.startsWith('/service/')) {
    logger.info('Already in proxy context, skipping service worker registration');
    isInitialized = true;
    window.__pythonProxyInitializing = false;
    return;
  }
  
  // Register the service worker for proxy functionality
  registerServiceWorker().then(success => {
    isInitialized = success;
    
    if (success) {
      logger.info('Proxy service fully initialized');
    } else {
      logger.error('Proxy service initialization failed');
    }
    
    window.__pythonProxyInitializing = false;
  }).catch(error => {
    logger.error('Error during proxy initialization:', error);
    window.__pythonProxyInitializing = false;
  });
}

/**
 * Process user input to determine if it's a URL or search query
 * @param {string} query - User input (URL or search term)
 * @param {string} searchEngine - Search engine URL template
 */
function processQuery(query, searchEngine) {
  logger.info('Processing query:', query);
  
  try {
    // Check if the input is likely a URL
    if (isUrl(query)) {
      // Ensure it has a protocol
      if (!query.startsWith('http://') && !query.startsWith('https://')) {
        query = 'https://' + query;
      }
      
      // Redirect to the proxy using the Python proxy adapter
      if (typeof window.redirectToProxy === 'function') {
        // Use the adapter's implementation
        window.redirectToProxy(query);
      } else {
        // Fallback to direct encoding if adapter not available
        const encodedUrl = btoa(query);
        window.location.href = `/service/${encodedUrl}`;
      }
    } else {
      // It's a search query, encode and send to search engine
      const searchUrl = searchEngine + encodeURIComponent(query);
      logger.info('Using search engine for query:', searchUrl);
      
      // Use the Python proxy adapter for search queries too
      if (typeof window.redirectToProxy === 'function') {
        window.redirectToProxy(searchUrl);
      } else {
        const encodedUrl = btoa(searchUrl);
        window.location.href = `/service/${encodedUrl}`;
      }
    }
  } catch (error) {
    logger.error('Error processing query:', error);
    alert('Error processing your request: ' + error.message);
  }
}

/**
 * Redirect to the proxied version of a URL
 * @param {string} url - The URL to access through the proxy
 */
function redirectToProxy(url) {
  logger.info('Redirecting to proxy for URL:', url);
  
  try {
    // Always use the Python proxy adapter if available
    if (typeof window.redirectToProxy === 'function' && window.redirectToProxy !== redirectToProxy) {
      // Call the adapter's implementation (which is now on the window object)
      window.redirectToProxy(url);
      return;
    }
    
    // Fallback to direct encoding if adapter not available
    const encodedUrl = btoa(url);
    window.location.href = `/service/${encodedUrl}`;
  } catch (error) {
    logger.error('Error redirecting to proxy:', error);
    
    const errorMessage = document.createElement('div');
    errorMessage.style.position = 'fixed';
    errorMessage.style.top = '10px';
    errorMessage.style.left = '50%';
    errorMessage.style.transform = 'translateX(-50%)';
    errorMessage.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
    errorMessage.style.color = 'white';
    errorMessage.style.padding = '10px 20px';
    errorMessage.style.borderRadius = '5px';
    errorMessage.style.zIndex = '10000';
    errorMessage.style.maxWidth = '80%';
    errorMessage.style.textAlign = 'center';
    errorMessage.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    
    errorMessage.innerHTML = `
      <p style="margin: 0; font-weight: bold;">Proxy Error</p>
      <p style="margin: 5px 0 0 0; font-size: 14px;">${error.message}</p>
    `;
    
    document.body.appendChild(errorMessage);
    
    // Remove the message after 5 seconds
    setTimeout(() => {
      if (errorMessage.parentNode) {
        errorMessage.parentNode.removeChild(errorMessage);
      }
    }, 5000);
  }
}

/**
 * Register the Python proxy service worker
    }
  }
}

/**
 * Register the Ultraviolet service worker
 * @returns {Promise<boolean>} - Whether registration was successful
 */
async function registerServiceWorker() {
  try {
    // Check if service workers are supported
    if (!browserInfo.isServiceWorkerSupported) {
      logger.error('Service workers not supported in this browser');
      return false;
    }
    
    // Check if we're on HTTPS - service workers require secure context
    const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    
    if (!isSecureContext) {
      logger.warn('Service worker registration may fail: Not in a secure context (HTTPS required)');
      // We'll still attempt registration but display a warning to the user
      const warningEl = document.createElement('div');
      warningEl.style.position = 'fixed';
      warningEl.style.bottom = '10px';
      warningEl.style.left = '10px';
      warningEl.style.backgroundColor = 'rgba(255, 193, 7, 0.9)';
      warningEl.style.color = 'black';
      warningEl.style.padding = '10px';
      warningEl.style.borderRadius = '5px';
      warningEl.style.zIndex = '9999';
      warningEl.style.maxWidth = '300px';
      warningEl.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      warningEl.innerHTML = 'For full proxy features, please use HTTPS. Some functionality may be limited.';
      document.body.appendChild(warningEl);
      
      // Remove after 10 seconds
      setTimeout(() => {
        if (warningEl.parentNode) {
          warningEl.parentNode.removeChild(warningEl);
        }
      }, 10000);
    }
    
    // Use the correct path for the service worker
    const swUrl = `/assets/uv/python-proxy-sw.js?v=${Date.now()}`; // Add cache-busting parameter
    
    logger.info('Registering service worker from:', swUrl);
    logger.info('Service worker scope:', '/service/');
    
    // Unregister any existing service workers first
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const existingRegistrations = registrations.filter(reg => 
        reg.scope.includes('/service/'));
      
      if (existingRegistrations.length > 0) {
        logger.info(`Found ${existingRegistrations.length} existing service worker(s), unregistering...`);
        
        for (const registration of existingRegistrations) {
          await registration.unregister();
          logger.info(`Unregistered service worker with scope: ${registration.scope}`);
        }
      }
    } catch (unregisterError) {
      logger.warn('Error unregistering existing service workers:', unregisterError);
      // Continue anyway
    }
    
    // Try registering with more options to help with insecure contexts
    const regOptions = {
      scope: '/service/',
      updateViaCache: 'none' // Don't use cached versions
    };
    
    const registration = await navigator.serviceWorker.register(swUrl, regOptions);
    
    logger.info('Service worker registered successfully:', registration);
    
    // Initialize bare client with the correct server path
    if (!window.bareClient) {
      logger.info('Initializing bare client');
      window.bareClient = new BareClient('/proxy/');
    }
    
    // Verify connectivity to bare server
    try {
      logger.info('Testing connectivity to bare server...');
      const result = await window.bareClient.ping();
      logger.info('Bare server connection successful:', result);
      window.bareClient.status = {
        connected: true,
        lastCheck: new Date(),
        error: null
      };
    } catch (pingError) {
      logger.warn('Failed to connect to bare server, trying fallback:', pingError);
      
      // Try fallback to bare-info
      try {
        const response = await fetch('/bare-info/');
        if (response.ok) {
          const data = await response.json();
          logger.info('Connected to bare-info fallback:', data);
          window.bareClient.status = {
            connected: true,
            lastCheck: new Date(),
            error: null
          };
        } else {
          throw new Error(`Server responded with status ${response.status}`);
        }
      } catch (fallbackError) {
        logger.error('All bare server connection attempts failed:', fallbackError);
        window.bareClient.status = {
          connected: false,
          lastCheck: new Date(),
          error: fallbackError.message
        };
      }
    }
    
    // Wait for the service worker to be installed
    return new Promise((resolve) => {
      // If already active, we're good to go
      if (registration.active) {
        logger.info(`Service worker already active for ${browserInfo.isFirefox ? 'Firefox' : 'Chrome'}`);
        resolve(true);
        return;
      }
      
      logger.info('Service worker installing');
      
      // Handle the installing state
      if (registration.installing) {
        registration.installing.addEventListener('statechange', (event) => {
          if (event.target.state === 'activated') {
            logger.info(`Service worker activated for ${browserInfo.isFirefox ? 'Firefox' : 'Chrome'}`);
            
            // Force claim clients so service worker controls all pages
            if (navigator.serviceWorker.controller) {
              logger.info('Service worker has taken control');
            } else {
              logger.warn('Service worker not controlling page yet');
              
              // Add event listener for controlled changes
              navigator.serviceWorker.addEventListener('controllerchange', () => {
                logger.info('Service worker now controlling page');
              });
            }
            
            resolve(true);
          } else if (event.target.state === 'redundant') {
            logger.error('Service worker installation failed');
            resolve(false);
          }
        });
      } else if (registration.waiting) {
        // If waiting, activate it immediately
        logger.info('Service worker waiting, activating now');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Listen for controllerchange to know when the service worker is activated
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          logger.info('Service worker took control');
          resolve(true);
        });
      } else {
        // This shouldn't happen, but just in case
        logger.warn('Unexpected service worker registration state');
        resolve(false);
      }
    });
  } catch (error) {
    logger.error('Error registering service worker:', error);
    return false;
  }
}

/**
 * Validate that the proxy service is working correctly
 * @returns {Promise<Object>} - Validation results
 */
async function validateProxyService() {
  const validation = {
    uvConfigLoaded: !!window.__uv$config,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    serviceWorkerActive: false,
    bareServerReachable: false,
    browserType: browserInfo.isFirefox ? 'Firefox' : browserInfo.isChrome ? 'Chrome' : 'Other'
  };
  
  // Check service worker status
  if (validation.serviceWorkerSupported) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const pythonProxyWorker = registrations.find(r => 
      r.scope && r.scope.includes(window.__uv$config?.prefix || '/service/')
    );
    validation.serviceWorkerActive = !!pythonProxyWorker && (!!pythonProxyWorker.active || !!pythonProxyWorker.installing);
  }
  
  // Check bare server connectivity
  if (window.bareClient && typeof window.bareClient.ping === 'function') {
    try {
      await window.bareClient.ping();
      validation.bareServerReachable = true;
    } catch (e) {
      validation.bareServerReachable = false;
    }
  }
  
  logger.info('Proxy service validation:', validation);
  return validation;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeProxy);

// Export functions for use in other modules
export { 
  initializeProxy, 
  processQuery, 
  redirectToProxy, 
  registerServiceWorker, 
  validateProxyService,
  browserInfo
}; 