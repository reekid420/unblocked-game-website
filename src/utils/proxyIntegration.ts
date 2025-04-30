// Proxy Integration (converted from legacy proxy-integration.js)
// Handles integration between the frontend and the Python proxy

import pythonProxyClient from './pythonProxyClient';
import { isUrl } from './utils';

let isInitialized = false;

const logger = {
  info: (message: any, ...args: any[]) => console.log(`[ProxyIntegration] ${message}`, ...args),
  warn: (message: any, ...args: any[]) => console.warn(`[ProxyIntegration] ${message}`, ...args),
  error: (message: any, ...args: any[]) => console.error(`[ProxyIntegration] ${message}`, ...args)
};

/**
 * Initialize the proxy integration
 * @returns Whether initialization was successful
 */
export async function initializeProxy(): Promise<boolean> {
  if (isInitialized) {
    logger.info('Proxy already initialized');
    return true;
  }
  logger.info('Initializing Python proxy integration');
  try {
    const success = await pythonProxyClient.initialize();
    if (success) {
      setupSearchForm();
      initializeQuickLinks();
      isInitialized = true;
      logger.info('Proxy integration initialized successfully');
      return true;
    } else {
      logger.error('Failed to initialize Python proxy client');
      return false;
    }
  } catch (error: any) {
    logger.error('Error initializing proxy integration:', error);
    return false;
  }
}

function setupSearchForm() {
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', function(event) {
      event.preventDefault();
      const searchInput = document.getElementById('searchbar') as HTMLInputElement;
      const query = searchInput ? searchInput.value.trim() : '';
      if (!query) {
        alert('Please enter a URL or search query');
        return;
      }
      const defaultSearchEngine = 'https://www.google.com/search?q=';
      processQuery(query, defaultSearchEngine);
    });
    logger.info('Search form handler registered');
  }
}

function initializeQuickLinks() {
  (window as any).redirectToProxy = redirectToProxy;
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

function processQuery(query: string, searchEngine: string) {
  logger.info('Processing query:', query);
  try {
    if (isUrl(query)) {
      if (!query.startsWith('http://') && !query.startsWith('https://')) {
        query = 'https://' + query;
      }
      redirectToProxy(query);
    } else {
      const searchUrl = searchEngine + encodeURIComponent(query);
      logger.info('Using search engine for query:', searchUrl);
      redirectToProxy(searchUrl);
    }
  } catch (error: any) {
    logger.error('Error processing query:', error);
    alert('Error processing your request: ' + error.message);
  }
}

/**
 * Redirect to the proxied version of a URL
 */
export async function redirectToProxy(url: string) {
  logger.info('Redirecting to proxy for URL:', url);
  try {
    if (!isInitialized) {
      const success = await initializeProxy();
      if (!success) {
        throw new Error('Failed to initialize proxy');
      }
    }
    const encodedUrl = btoa(url);
    window.location.href = `/service/${encodedUrl}`;
  } catch (error: any) {
    logger.error('Error redirecting to proxy:', error);
    alert('Error accessing the proxy: ' + error.message);
  }
}

/**
 * Send a chat message to the AI
 */
export async function sendChatMessage(message: string, conversationId: string | null = null): Promise<any> {
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
 */
export async function getSuggestedTopics(): Promise<any> {
  if (!isInitialized) {
    await initializeProxy();
  }
  return pythonProxyClient.getSuggestedTopics();
}

// Optionally, call initializeProxy() on DOMContentLoaded if needed in vanilla usage
// document.addEventListener('DOMContentLoaded', initializeProxy);
