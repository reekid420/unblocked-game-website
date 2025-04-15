/**
 * Proxy Integration
 * Handles integration between the frontend and the Python proxy
 */
import pythonProxyClient from './python-proxy-client.js';
import { isUrl } from './utils.js';

// Track initialization state
let isInitialized = false;

// Logger for debugging
const logger = {
  info: (message, ...args) => console.log(`[ProxyIntegration] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[ProxyIntegration] ${message}`, ...args),
  error: (message, ...args) => console.error(`[ProxyIntegration] ${message}`, ...args)
};

/**
 * Initialize the proxy integration
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initializeProxy() {
  if (isInitialized) {
    logger.info('Proxy already initialized');
    return true;
  }
  
  logger.info('Initializing Python proxy integration');
  
  try {
    // Initialize the Python proxy client
    const success = await pythonProxyClient.initialize();
    
    if (success) {
      // Set up event listeners for search form
      setupSearchForm();
      
      // Initialize quick links
      initializeQuickLinks();
      
      isInitialized = true;
      logger.info('Proxy integration initialized successfully');
      return true;
    } else {
      logger.error('Failed to initialize Python proxy client');
      return false;
    }
  } catch (error) {
    logger.error('Error initializing proxy integration:', error);
    return false;
  }
}

/**
 * Set up the search form event listener
 */
function setupSearchForm() {
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
}

/**
 * Initialize the quick links to use the correct redirection function
 */
function initializeQuickLinks() {
  // Make the redirectToProxy function available for inline onclick handlers
  window.redirectToProxy = redirectToProxy;
  
  // Attach event listeners to quick links if they don't have onclick handlers
  const quicklinks = document.querySelectorAll('.quicklink');
  quicklinks.forEach(link => {
    if (!link.getAttribute('onclick')) {
      const url = link.getAttribute('data-url');
      if (url) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          redirectToProxy(url);
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
async function redirectToProxy(url) {
  logger.info('Redirecting to proxy for URL:', url);
  try {
    // Initialize proxy if not already initialized
    if (!isInitialized) {
      const success = await initializeProxy();
      if (!success) {
        throw new Error('Failed to initialize proxy');
      }
    }
    // Always visually proxy by navigating to /service/:encodedUrl
    const encodedUrl = btoa(url);
    window.location.href = `/service/${encodedUrl}`;
  } catch (error) {
    logger.error('Error redirecting to proxy:', error);
    alert('Error accessing the proxy: ' + error.message);
  }
}


/**
 * Send a chat message to the AI
 * @param {string} message - Chat message
 * @param {string} conversationId - Optional conversation ID
 * @returns {Promise<Object>} AI response
 */
async function sendChatMessage(message, conversationId = null) {
  if (!isInitialized) {
    await initializeProxy();
  }
  
  const messageData = {
    message,
    conversationId,
    userId: localStorage.getItem('userId') || 'anonymous'
  };
  
  return pythonProxyClient.sendChatMessage(messageData);
}

/**
 * Get suggested topics from the AI
 * @returns {Promise<Object>} Topics data
 */
async function getSuggestedTopics() {
  if (!isInitialized) {
    await initializeProxy();
  }
  
  return pythonProxyClient.getSuggestedTopics();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeProxy);

// Export functions for use in other modules
export {
  initializeProxy,
  redirectToProxy,
  sendChatMessage,
  getSuggestedTopics
};
