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
  
  // Check if we're in Firefox and have previously detected security errors
  const hasFirefoxSecurityIssue = browserInfo.isFirefox && 
                                 (sessionStorage.getItem('uv-sw-security-error') === 'true');
  
  // If Firefox has security issues, show a browser recommendation banner
  if (hasFirefoxSecurityIssue && !document.getElementById('firefox-notice')) {
    const notice = document.createElement('div');
    notice.id = 'firefox-notice';
    notice.style.background = '#1976d2';
    notice.style.color = 'white';
    notice.style.padding = '10px 20px';
    notice.style.textAlign = 'center';
    notice.style.position = 'fixed';
    notice.style.bottom = '0';
    notice.style.left = '0';
    notice.style.right = '0';
    notice.style.zIndex = '9999';
    notice.style.boxShadow = '0 -2px 5px rgba(0,0,0,0.2)';
    notice.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span>⚠️ For best proxy experience, try Chrome or Edge instead of Firefox</span>
        <div>
          <button id="firefox-fallback" style="background:#2196f3;color:white;border:none;padding:5px 10px;margin-right:10px;border-radius:3px;cursor:pointer">Use Fallback Mode</button>
          <button id="close-notice" style="background:transparent;color:white;border:1px solid white;padding:5px 10px;border-radius:3px;cursor:pointer">Dismiss</button>
        </div>
      </div>
    `;
    document.body.appendChild(notice);
    
    // Add event listeners
    setTimeout(() => {
      const closeButton = document.getElementById('close-notice');
      const fallbackButton = document.getElementById('firefox-fallback');
      
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          notice.style.display = 'none';
        });
      }
      
      if (fallbackButton) {
        fallbackButton.addEventListener('click', () => {
          // Enable fallback mode
          window.__uvFallbackMode = true;
          sessionStorage.setItem('uv-fallback-mode', 'true');
          notice.innerHTML = '<div style="text-align:center">✅ Fallback mode enabled! The proxy will use an alternative method</div>';
          setTimeout(() => {
            notice.style.display = 'none';
          }, 3000);
        });
      }
    }, 100);
  }
  
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
 * Redirect to proxy with the given URL
 */
function redirectToProxy(url) {
  try {
    logger.info('Redirecting to proxy URL:', url);
    
    // Check if the user has explicitly enabled fallback mode or if we're in Firefox with known issues
    const usingFallback = window.__uvFallbackMode || 
                        sessionStorage.getItem('uv-fallback-mode') === 'true' || 
                        (browserInfo.isFirefox && sessionStorage.getItem('uv-sw-security-error') === 'true');
    
    // If we're using fallback mode, skip the service worker approach entirely
    if (usingFallback) {
      logger.info('Using fallback proxy mode (skipping service worker)');
      
      // Create a fallback proxy iframe approach
      const proxyFrame = document.createElement('iframe');
      proxyFrame.style.position = 'fixed';
      proxyFrame.style.top = '0';
      proxyFrame.style.left = '0';
      proxyFrame.style.width = '100%';
      proxyFrame.style.height = '100%';
      proxyFrame.style.border = 'none';
      proxyFrame.style.zIndex = '9999';
      proxyFrame.style.background = 'white';
      
      // Show loading spinner
      const spinner = document.createElement('div');
      spinner.style.position = 'fixed';
      spinner.style.top = '50%';
      spinner.style.left = '50%';
      spinner.style.transform = 'translate(-50%, -50%)';
      spinner.style.zIndex = '10000';
      spinner.innerHTML = '<div style="text-align:center"><div style="border:5px solid #f3f3f3;border-top:5px solid #3498db;border-radius:50%;width:50px;height:50px;animation:spin 2s linear infinite;margin:0 auto"></div><p style="margin-top:10px">Loading...</p></div>';
      document.body.appendChild(spinner);
      
      // Add style for spinner animation
      const style = document.createElement('style');
      style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
      document.head.appendChild(style);
      
      // Add a close button for the iframe
      const closeButton = document.createElement('button');
      closeButton.textContent = '✕ Close';
      closeButton.style.position = 'fixed';
      closeButton.style.top = '10px';
      closeButton.style.right = '10px';
      closeButton.style.zIndex = '10001';
      closeButton.style.padding = '5px 10px';
      closeButton.style.background = '#e74c3c';
      closeButton.style.color = 'white';
      closeButton.style.border = 'none';
      closeButton.style.borderRadius = '3px';
      closeButton.style.cursor = 'pointer';
      closeButton.addEventListener('click', () => {
        proxyFrame.remove();
        closeButton.remove();
      });
      
      // Use a third-party proxy service as fallback
      const fallbackProxyUrl = `https://www.proxysite.com/go/${encodeURIComponent(url)}`;
      proxyFrame.src = fallbackProxyUrl;
      
      // Add to page when loaded
      proxyFrame.onload = () => {
        spinner.remove();
        document.body.appendChild(proxyFrame);
        document.body.appendChild(closeButton);
      };
      
      return;
    }
    
    // For non-fallback mode, check if the proxy system is initialized
    const proxyInitialized = window.__uvInited && window.UV;
    
    if (!proxyInitialized) {
      logger.warn('Proxy system not initialized, attempting initialization before redirect');
      
      // Set up a promise to resolve when the proxy is ready
      const proxyPromise = new Promise((resolve) => {
        // Store the resolve function for later use
        window.__uvResolveRedirect = resolve;
        
        // Initialize if not already done
        if (!window.__uvInitializing) {
          initializeProxy();
        }
      });
      
      // Wait for initialization to complete before proceeding
      proxyPromise.then(() => {
        logger.info('Proxy initialization completed, proceeding with redirect');
        
        // Check again if UV is properly initialized
        const uvInitialized = window.UV && window.__uv;
        
        if (uvInitialized) {
          logger.info('UV successfully initialized, performing redirect');
          
          // Clear any previous redirect attempts
          sessionStorage.removeItem('pendingProxyRedirect');
          
          // Set a flag to indicate we're attempting a redirect
          sessionStorage.setItem('pendingProxyRedirect', url);
          
          // Try standard UV approach
          try {
            // Open in current window
            window.location.href = __uv$config.prefix + __uv$config.encodeUrl(url);
            return;
          } catch (uvError) {
            logger.error('Error using UV to proxy URL:', uvError);
            
            // Auto-switch to fallback mode on error
            window.__uvFallbackMode = true;
            sessionStorage.setItem('uv-fallback-mode', 'true');
            
            // Try again with fallback
            redirectToProxy(url);
            return;
          }
        } else {
          throw new Error('Failed to initialize proxy service');
        }
      });
      
      return;
    }
    
    // Redirect directly if already initialized
    try {
      window.location.href = __uv$config.prefix + __uv$config.encodeUrl(url);
    } catch (error) {
      // If direct redirect fails, try fallback
      window.__uvFallbackMode = true;
      sessionStorage.setItem('uv-fallback-mode', 'true');
      redirectToProxy(url);
    }
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
    
    // Use the correct path for the service worker with strong cache busting
    // Add timestamp to force fresh load (important fix for cache issues)
    const timestamp = Date.now();
    // Force unique URLs for Firefox to bypass service worker cache
    const cacheBuster = Math.random().toString(36).substring(2, 15);
    const swUrl = `/assets/uv/uv.sw.js?v=${timestamp}&r=${cacheBuster}`;
    
    logger.info('Registering service worker from:', swUrl);
    logger.info('Service worker scope:', '/service/');
    
    // Verify the service worker file is actually available before attempting registration
    try {
      const swResponse = await fetch(swUrl, { method: 'HEAD' });
      if (!swResponse.ok) {
        logger.error(`Service worker file not found or inaccessible: ${swUrl} (status: ${swResponse.status})`);
        throw new Error(`Service worker file not available (status: ${swResponse.status})`);
      }
      
      // Check content type
      const contentType = swResponse.headers.get('content-type');
      logger.info(`Service worker file content type: ${contentType}`);
      
      if (contentType && !contentType.includes('javascript')) {
        logger.warn(`Service worker has incorrect MIME type: ${contentType}, should be application/javascript`);
        // We'll continue anyway as we've added server-side content type handling
      }
    } catch (fetchError) {
      logger.error('Error pre-checking service worker file:', fetchError);
      // Continue anyway, the registration will fail with a more specific error
    }
    
    // Firefox specific fix: Check if we've previously failed due to security error
    // and skip repeated attempts if that's the case
    if (browserInfo.isFirefox && sessionStorage.getItem('uv-sw-security-error')) {
      logger.warn('Skipping service worker registration due to previous security error in Firefox');
      return false;
    }
    
    // Unregister any existing service workers first
    try {
      // Force update on all service workers before unregistering
      if (browserInfo.isFirefox) {
        logger.info('Firefox detected: Forcing update on all service workers');
        const allRegistrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of allRegistrations) {
          try {
            // Force immediate update
            await reg.update();
            logger.info(`Forced update on service worker with scope: ${reg.scope}`);
          } catch (updateErr) {
            logger.warn(`Could not update service worker with scope: ${reg.scope}`, updateErr);
          }
        }
      }
      
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
    
    // Firefox sometimes has issues with service workers even over HTTPS
    // Let's check if the origin is secure in multiple ways
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const explicitlySecure = protocol === 'https:' || 
                           hostname === 'localhost' || 
                           hostname === '127.0.0.1';
    
    logger.info('Security check - Protocol:', protocol, 'Hostname:', hostname, 
               'Explicitly secure:', explicitlySecure, 
               'isSecureContext:', window.isSecureContext);
               
    // Check if we are in a cross-origin iframe which could cause security issues
    const isCrossOriginFrame = window !== window.top && document.referrer && 
                             new URL(document.referrer).origin !== window.location.origin;
    if (isCrossOriginFrame) {
      logger.warn('Detected cross-origin iframe, which may cause service worker security issues');
    }
    
    // Set up service worker registration options
    const swOptions = {
      scope: '/service/',
      updateViaCache: 'none'
    };
    
    let registration;
    
    // Add specific Firefox handling for problematic registrations
    if (browserInfo.isFirefox) {
      // Try a different approach for Firefox
      logger.info('Using Firefox-specific service worker registration approach');
      
      try {
        // Use a timeout to abort registration if it takes too long
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Service worker registration timed out')), 10000);
        });
        
        // Register the service worker with no options first
        registration = await Promise.race([
          navigator.serviceWorker.register(swUrl),
          timeoutPromise
        ]);
        
        logger.info('Initial Firefox service worker registration succeeded');
        
        // If that worked, try with scope
        registration = await navigator.serviceWorker.register(swUrl, swOptions);
        
        logger.info('Service worker successfully registered with scope in Firefox');
      } catch (firefoxError) {
        if (firefoxError.name === 'SecurityError') {
          // Remember this error to avoid repeated attempts
          sessionStorage.setItem('uv-sw-security-error', 'true');
          
          logger.error('Firefox security error when registering service worker:', firefoxError);
          
          // Show a Firefox-specific error message
          const warningEl = document.createElement('div');
          warningEl.style.background = '#ffebee';
          warningEl.style.color = '#c62828';
          warningEl.style.padding = '10px';
          warningEl.style.margin = '10px 0';
          warningEl.style.borderRadius = '5px';
          warningEl.style.fontWeight = 'bold';
          warningEl.style.position = 'fixed';
          warningEl.style.top = '0';
          warningEl.style.left = '0';
          warningEl.style.right = '0';
          warningEl.style.zIndex = '9999';
          warningEl.style.textAlign = 'center';
          warningEl.innerHTML = `<p>⚠️ Firefox security issue detected</p>
            <p>This site is running over HTTPS but Firefox has blocked the service worker.</p>
            <p>Try using Chrome for full functionality or enable insecure service workers in Firefox.</p>
            <button onclick="this.parentNode.style.display='none'" style="padding:5px 10px;margin-top:5px;background:#c62828;color:white;border:0;border-radius:3px;cursor:pointer;">Dismiss</button>`;
          
          document.body.appendChild(warningEl);
          
          // Set Firefox-specific issue flag
          window.__uvFirefoxIssue = true;
          throw firefoxError;
        } else {
          // Rethrow non-security errors
          throw firefoxError;
        }
      }
    } else {
      // For non-Firefox browsers, use regular registration with timeout protection
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Service worker registration timed out')), 10000);
        });
        
        registration = await Promise.race([
          navigator.serviceWorker.register(swUrl, swOptions),
          timeoutPromise
        ]);
        
        logger.info('Service worker registered successfully', {
          scope: registration.scope,
          installing: !!registration.installing,
          waiting: !!registration.waiting,
          active: !!registration.active
        });
      } catch (regError) {
        logger.error('Error during service worker registration:', regError);
        throw regError; // Re-throw to be caught by the outer try/catch
      }
    }
    
    // Initialize bare client with the correct server path
    if (!window.bareClient) {
      logger.info('Initializing bare client');
      window.bareClient = new BareClient('/bare-server/');
    }
    
    // Add message channel to communicate with service worker
    try {
      if (registration && registration.active) {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          logger.info('Received message from service worker:', event.data);
        };
        
        registration.active.postMessage({
          type: 'CLIENT_READY',
          timestamp: Date.now()
        }, [messageChannel.port2]);
        
        logger.info('Established message channel with service worker');
      }
    } catch (msgError) {
      logger.warn('Error establishing message channel with service worker:', msgError);
      // Not critical, continue
    }
    
    // Verify connectivity to bare server
    try {
      logger.info('Testing connectivity to bare server...');
      const result = await Promise.race([
        window.bareClient.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Bare server ping timed out')), 5000))
      ]);
      
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('/bare-info/', {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        clearTimeout(timeoutId);
        
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
    
    // Wait for the service worker to be fully activated
    return new Promise((resolve) => {
      // If already active, we're good to go
      if (registration.active) {
        logger.info(`Service worker already active for ${browserInfo.isFirefox ? 'Firefox' : 'Chrome'}`);
        
        // Force claim clients so service worker controls all pages
        if (navigator.serviceWorker.controller) {
          logger.info('Service worker has taken control');
        } else {
          logger.warn('Service worker not controlling page yet');
          
          // Add event listener for controlled changes
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            logger.info('Service worker now controlling page');
          });
          
          // Try to claim clients
          navigator.serviceWorker.ready.then(reg => {
            logger.info('Sending claim message to service worker');
            reg.active.postMessage({ type: 'CLAIM_CLIENTS' });
          }).catch(err => {
            logger.error('Error sending claim message:', err);
          });
        }
        
        resolve(true);
      } else if (registration.installing) {
        // Set up event listener for the installing worker
        logger.info('Service worker is installing, waiting for activation...');
        
        // Set a timeout to resolve after 10 seconds even if we don't get an activation event
        const timeout = setTimeout(() => {
          logger.warn('Service worker activation timed out, continuing anyway');
          resolve(true);
        }, 10000);
        
        registration.installing.addEventListener('statechange', (event) => {
          logger.info('Service worker state changed:', event.target.state);
          
          if (event.target.state === 'activated') {
            clearTimeout(timeout);
            logger.info('Service worker activated');
            resolve(true);
          } else if (event.target.state === 'redundant') {
            clearTimeout(timeout);
            logger.error('Service worker installation failed, became redundant');
            resolve(false);
          }
        });
      } else if (registration.waiting) {
        // If waiting, activate it immediately
        logger.info('Service worker waiting, activating now');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Listen for controllerchange to know when the service worker is activated
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          clearTimeout(timeout);
          logger.info('Service worker took control');
          resolve(true);
        });
      } else {
        // This shouldn't happen, but just in case
        logger.warn('Unexpected service worker registration state');
        clearTimeout(timeout);
        resolve(false);
      }
    });
  } catch (error) {
    logger.error('Error registering service worker:', error);
    // Get detailed error information
    const errorInfo = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      browser: browserInfo.userAgent,
      location: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    // Log detailed error for debugging
    logger.error('Detailed service worker error:', JSON.stringify(errorInfo));
    
    // Show a more prominent error message in the UI with detailed information
    if (!window.__uvInsecureContext) { // Only show if not already shown secure context warning
      const errorContainer = document.createElement('div');
      errorContainer.style.background = '#fff3cd';
      errorContainer.style.color = '#856404';
      errorContainer.style.padding = '15px';
      errorContainer.style.margin = '15px 0';
      errorContainer.style.borderRadius = '5px';
      errorContainer.style.border = '1px solid #ffeeba';
      errorContainer.innerHTML = `
        <h3 style="margin-top:0">Proxy Service Error</h3>
        <p>The web proxy service could not be initialized. This may be due to:</p>
        <ul>
          <li>Connection over HTTP instead of HTTPS</li>
          <li>Service worker registration failure: ${error.name}</li>
          <li>Browser restrictions or compatibility issues</li>
        </ul>
        <p>Error details: ${error.message}</p>
        <div>
          <button onclick="window.location.reload()" style="padding:5px 10px;margin-top:5px;background:#856404;color:white;border:0;border-radius:3px;cursor:pointer;">Retry</button>
          <button onclick="this.parentNode.parentNode.style.display='none'" style="padding:5px 10px;margin-top:5px;margin-left:10px;background:transparent;color:#856404;border:1px solid #856404;border-radius:3px;cursor:pointer;">Dismiss</button>
        </div>
      `;
      
      // Insert after header or at top of main content
      const mainContent = document.querySelector('main') || document.body;
      if (mainContent.firstChild) {
        mainContent.insertBefore(errorContainer, mainContent.firstChild);
      } else {
        mainContent.appendChild(errorContainer);
      }
    }
    
    // Add debugging info to console for easier troubleshooting
    console.group('Proxy Service Debugging Information');
    console.log('Browser:', browserInfo.userAgent);
    console.log('Service Worker API available:', 'serviceWorker' in navigator);
    console.log('Protocol:', window.location.protocol);
    console.log('URL:', window.location.href);
    console.log('Error:', error);
    console.groupEnd();
    
    // Indicate that initialization has failed
    isInitialized = false;
    window.__uvInitializing = false;
    
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