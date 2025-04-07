/**
 * UV Proxy functionality
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
  info: (message, ...args) => console.log(`[UV${browserInfo.isFirefox ? '-FF' : browserInfo.isChrome ? '-CR' : ''}] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[UV${browserInfo.isFirefox ? '-FF' : browserInfo.isChrome ? '-CR' : ''}] ${message}`, ...args),
  error: (message, ...args) => console.error(`[UV${browserInfo.isFirefox ? '-FF' : browserInfo.isChrome ? '-CR' : ''}] ${message}`, ...args)
};

/**
 * Initialize the proxy functionality
 */
function initializeProxy() {
  // Check if we're already initializing to prevent double initialization
  if (window.__uvInitializing) {
    logger.info('Proxy initialization already in progress, skipping duplicate call');
    return;
  }
  window.__uvInitializing = true;
  
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
  
  // Initialize quick links
  initializeQuickLinks();
  
  // Check if we're already in a proxy context - if so don't re-register the service worker
  if (window.location.pathname.startsWith('/service/')) {
    logger.info('Already in proxy context, skipping service worker registration');
    isInitialized = true;
    window.__uvInitializing = false;
    return;
  }
  
  // Register the service worker for proxy functionality
  registerServiceWorker().then(success => {
    isInitialized = success;
    
    if (success) {
      logger.info('Proxy service fully initialized');
      
      // Check bare server connectivity after initialization
      if (window.bareClient && typeof window.bareClient.ping === 'function') {
        window.bareClient.ping()
          .then(data => logger.info('Bare server is reachable:', data))
          .catch(err => logger.warn('Bare server connectivity check failed:', err.message));
      }
    } else {
      logger.error('Proxy service initialization failed');
    }
    
    window.__uvInitializing = false;
  }).catch(error => {
    logger.error('Error during proxy initialization:', error);
    window.__uvInitializing = false;
  });
}

/**
 * Initialize the quick links to use the correct redirection function
 */
function initializeQuickLinks() {
  // Make the redirectToProxy function available for inline onclick handlers
  window.redirectToProxy = redirectToProxy;
  
  // Check if we're using older hiring function or new uv
  const useUv = typeof window.uv !== 'undefined';
  const useHire = typeof window.hire === 'function';
  
  logger.info(`Proxy methods available: UV: ${useUv}, Hire: ${useHire}`);
  
  // Attach event listeners to quick links if they don't have onclick handlers
  const quicklinks = document.querySelectorAll('.quicklink');
  quicklinks.forEach(link => {
    if (!link.getAttribute('onclick')) {
      const url = link.getAttribute('data-url');
      if (url) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          if (useUv) {
            redirectToProxy(url);
          } else if (useHire) {
            window.hire(url);
          } else {
            logger.error('No proxy method available');
            alert('Proxy service is not initialized properly.');
          }
        });
      }
    }
  });
  
  logger.info(`Initialized ${quicklinks.length} quick links`);
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
      
      // Redirect to the proxy
      redirectToProxy(query);
    } else {
      // It's a search query, encode and send to search engine
      const searchUrl = searchEngine + encodeURIComponent(query);
      logger.info('Using search engine for query:', searchUrl);
      redirectToProxy(searchUrl);
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
    // Check if the proxy is initialized
    if (!isInitialized && browserInfo.isServiceWorkerSupported) {
      logger.warn('Proxy not initialized, attempting initialization first');
      
      // Try to initialize and then redirect
      registerServiceWorker().then(async success => {
        if (success) {
          logger.info('Proxy initialized successfully, now redirecting');
          
          // Validate bare server connectivity before redirecting
          if (window.bareClient) {
            try {
              await window.bareClient.ping();
              logger.info('Bare server connection verified, proceeding with redirect');
            } catch (bareError) {
              logger.warn('Bare server connectivity issue detected. Attempting to use fallback methods.');
              // Continue anyway as the actual proxy request might still work
              // Some bare implementations don't support ping properly
            }
          }
          
          // Wait a moment for the service worker to fully initialize
          setTimeout(() => {
            // Set a flag to indicate we're attempting a redirect
            sessionStorage.setItem('pendingProxyRedirect', url);
            
            // Attempt the redirect
            redirectToProxyInternal(url);
          }, 500);
        } else {
          throw new Error('Failed to initialize proxy service');
        }
      });
      
      return;
    }
    
    // Redirect directly if already initialized
    redirectToProxyInternal(url);
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
 * Internal function to actually perform the redirect
 */
function redirectToProxyInternal(url) {
  // Ensure URL has protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  // Prevent redirect loops by checking if we're already in a service worker context
  if (window.location.pathname.startsWith('/service/')) {
    logger.warn('Already in proxy context, preventing redirect loop');
    // Just update the URL in the address bar without reloading
    try {
      const newEncodedUrl = window.uv.encode(url);
      const newProxyUrl = '/service/' + newEncodedUrl;
      window.history.replaceState({}, '', newProxyUrl);
      return;
    } catch (error) {
      logger.error('Failed to update URL in proxy context:', error);
      // Continue with normal redirect as fallback
    }
  }
  
  // Check for recent redirects to prevent loops
  const lastAttempt = sessionStorage.getItem('lastProxyAttempt');
  if (lastAttempt) {
    const timeSinceLastAttempt = Date.now() - parseInt(lastAttempt);
    if (timeSinceLastAttempt < 1000) { // Less than 1 second since last redirect
      logger.warn('Redirect throttled: too many redirects in short period');
      
      // Show error message instead of redirecting again
      const errorMessage = document.createElement('div');
      errorMessage.style.position = 'fixed';
      errorMessage.style.top = '10px';
      errorMessage.style.left = '50%';
      errorMessage.style.transform = 'translateX(-50%)';
      errorMessage.style.backgroundColor = 'rgba(255, 193, 7, 0.9)';
      errorMessage.style.color = 'black';
      errorMessage.style.padding = '10px 20px';
      errorMessage.style.borderRadius = '5px';
      errorMessage.style.zIndex = '10000';
      errorMessage.style.textAlign = 'center';
      
      errorMessage.innerHTML = 'Redirect loop detected. Please try again in a moment.';
      document.body.appendChild(errorMessage);
      
      setTimeout(() => {
        if (errorMessage.parentNode) {
          errorMessage.parentNode.removeChild(errorMessage);
        }
      }, 3000);
      
      return;
    }
  }
  
  // Check if UV client is available
  if (typeof window.uv !== 'undefined') {
    try {
      // Clear any previous bare client errors
      if (window.bareClient && window.bareClient.status.error) {
        console.log('[UV] Resetting previous bare client errors');
        window.bareClient.status.error = null;
      }
      
      // Double-check that UV is properly configured
      if (!window.__uv$config) {
        throw new Error('UV config not initialized');
      }
      
      // Encode the URL for the proxy
      const encodedUrl = window.uv.encode(url);
      const proxyUrl = window.location.origin + '/service/' + encodedUrl;
      
      logger.info('Proxy URL:', proxyUrl);
      
      // Set redirect tracking info BEFORE redirect
      sessionStorage.setItem('lastProxyAttempt', Date.now().toString());
      sessionStorage.setItem('lastProxyUrl', url);
      
      // Wait a moment to ensure service worker is ready
      setTimeout(() => {
        // Navigate to the proxy URL
        window.location.href = proxyUrl;
      }, 100);
      
      // Show a loading indicator
      const loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'proxy-loading-indicator';
      loadingIndicator.style.position = 'fixed';
      loadingIndicator.style.top = '0';
      loadingIndicator.style.left = '0';
      loadingIndicator.style.width = '100%';
      loadingIndicator.style.height = '5px';
      loadingIndicator.style.background = 'linear-gradient(to right, #4286f4, #42a1f4)';
      loadingIndicator.style.zIndex = '999999';
      loadingIndicator.style.animation = 'proxyLoading 2s infinite';
      
      // Add animation style
      const style = document.createElement('style');
      style.textContent = `
        @keyframes proxyLoading {
          0% { width: 0%; left: 0; }
          50% { width: 70%; left: 15% }
          100% { width: 0%; left: 100% }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(loadingIndicator);
      
      // Remove the indicator after 10 seconds (failsafe)
      setTimeout(() => {
        if (loadingIndicator.parentNode) {
          loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
      }, 10000);
    } catch (encodeError) {
      logger.error('Error encoding URL:', encodeError);
      throw new Error('Failed to encode URL for proxying: ' + encodeError.message);
    }
  } else {
    // Fallback to legacy method if available
    if (typeof window.hire === 'function') {
      logger.info('Falling back to legacy hiring method');
      window.hire(url);
    } else {
      throw new Error('Proxy client not available. Try refreshing the page.');
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
    
    // Use the correct path for the service worker
    const swUrl = `/assets/uv/uv.sw.js`;
    
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
    
    // Register the new service worker with the correct scope
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: '/service/'
    });
    
    logger.info('Service worker registered successfully:', registration);
    
    // Initialize bare client with the correct server path
    if (!window.bareClient) {
      logger.info('Initializing bare client');
      window.bareClient = new BareClient('/bare-server/');
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
    const uvWorker = registrations.find(r => 
      r.scope && r.scope.includes(window.__uv$config?.prefix || '/service/')
    );
    validation.serviceWorkerActive = !!uvWorker && (!!uvWorker.active || !!uvWorker.installing);
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