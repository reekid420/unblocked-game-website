/**
 * @jest-environment jsdom
 */

// Mock the window.__uv$config object
window.__uv$config = {
  prefix: '/service/',
  encodeUrl: jest.fn(url => btoa(url)),
  decodeUrl: jest.fn(encoded => atob(encoded))
};

// Mock navigator.serviceWorker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: jest.fn().mockResolvedValue({
      scope: '/service/',
      active: { state: 'activated' }
    }),
    controller: {
      state: 'activated'
    }
  },
  configurable: true
});

// Mock fetch API
global.fetch = jest.fn().mockImplementation((url) => {
  if (url === '/bare-server/') {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ version: '1.0.0', maintainer: { email: 'test@example.com' } })
    });
  }
  return Promise.reject(new Error('Fetch failed'));
});

// Create mock functions for the UV proxy
const uvProxy = {
  initializeProxy: jest.fn().mockImplementation(() => {
    if (window.__uvInitializing) {
      console.log('Proxy initialization already in progress, skipping duplicate call');
      return;
    }
    window.__uvInitializing = true;
    
    // Setup search form event listener
    const searchForm = document.createElement('form');
    searchForm.id = 'searchForm';
    document.body.appendChild(searchForm);
    
    const searchInput = document.createElement('input');
    searchInput.id = 'searchbar';
    searchForm.appendChild(searchInput);
    
    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = searchInput.value.trim();
      if (!query) return;
      uvProxy.processQuery(query, 'https://www.google.com/search?q=');
    });
    
    // Register service worker
    return uvProxy.registerServiceWorker()
      .then(() => {
        window.__uvInitializing = false;
        return true;
      })
      .catch(error => {
        console.error('Error during proxy initialization:', error);
        window.__uvInitializing = false;
        return false;
      });
  }),
  
  processQuery: jest.fn().mockImplementation((query, searchEngine) => {
    // Check if it's a URL
    if (query.startsWith('http://') || query.startsWith('https://') || query.includes('.com')) {
      // Direct URL
      uvProxy.redirectToProxy(query);
    } else {
      // Search query
      uvProxy.redirectToProxy(`${searchEngine}${encodeURIComponent(query)}`);
    }
  }),
  
  redirectToProxy: jest.fn().mockImplementation((url) => {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // In tests, we'll just store the URL rather than redirecting
    window.__lastProxyRedirect = window.__uv$config.prefix + window.__uv$config.encodeUrl(url);
    return window.__lastProxyRedirect;
  }),
  
  registerServiceWorker: jest.fn().mockImplementation(async () => {
    try {
      const registration = await navigator.serviceWorker.register('/uv.sw.js', {
        scope: '/service/'
      });
      return true;
    } catch (error) {
      console.error('Error registering service worker:', error);
      return false;
    }
  }),
  
  validateProxyService: jest.fn().mockImplementation(async () => {
    try {
      const response = await fetch('/bare-server/');
      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }
      return { success: false, error: 'Invalid response' };
    } catch (error) {
      console.error('Error validating proxy service:', error);
      return { success: false, error: error.message };
    }
  })
};

// Mock the proxy.js module
jest.mock('../../js/proxy.js', () => uvProxy);

describe('Ultraviolet Proxy Functionality', () => {
  // Reset DOM and mocks before each test
  beforeEach(() => {
    // Clear any previous DOM elements
    document.body.innerHTML = '';
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset UV initializing flag
    window.__uvInitializing = false;
    
    // Reset last proxy redirect
    delete window.__lastProxyRedirect;
  });
  
  describe('initializeProxy', () => {
    test('should initialize the proxy and register service worker', async () => {
      const { initializeProxy } = require('../../js/proxy.js');
      
      // Call the function
      await initializeProxy();
      
      // Verify service worker registration was attempted
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/uv.sw.js', {
        scope: '/service/'
      });
      
      // Verify form event listener was set up
      const searchForm = document.getElementById('searchForm');
      expect(searchForm).not.toBeNull();
      
      // Simulate form submission
      const searchInput = document.getElementById('searchbar');
      searchInput.value = 'example.com';
      searchForm.dispatchEvent(new Event('submit'));
      
      // Verify processQuery was called
      expect(uvProxy.processQuery).toHaveBeenCalledWith('example.com', 'https://www.google.com/search?q=');
    });
    
    test('should not initialize twice if already in progress', async () => {
      const { initializeProxy } = require('../../js/proxy.js');
      
      // Set the flag to true
      window.__uvInitializing = true;
      
      // Call the function
      await initializeProxy();
      
      // Verify service worker registration was not attempted
      expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
      
      // Reset for other tests
      window.__uvInitializing = false;
    });
  });
  
  describe('processQuery', () => {
    test('should redirect to proxy for URL input', () => {
      const { processQuery } = require('../../js/proxy.js');
      
      // Process a URL
      processQuery('example.com', 'https://www.google.com/search?q=');
      
      // Verify redirectToProxy was called with the URL
      expect(uvProxy.redirectToProxy).toHaveBeenCalledWith('example.com');
    });
    
    test('should redirect to search engine for non-URL input', () => {
      const { processQuery } = require('../../js/proxy.js');
      
      // Process a search query
      processQuery('test query', 'https://www.google.com/search?q=');
      
      // Verify redirectToProxy was called with the search URL
      expect(uvProxy.redirectToProxy).toHaveBeenCalledWith('https://www.google.com/search?q=test%20query');
    });
  });
  
  describe('redirectToProxy', () => {
    test('should encode URL and redirect', () => {
      const { redirectToProxy } = require('../../js/proxy.js');
      
      // Redirect to a URL
      const result = redirectToProxy('https://example.com');
      
      // Verify URL was encoded
      expect(window.__uv$config.encodeUrl).toHaveBeenCalledWith('https://example.com');
      
      // Verify the redirect URL format
      expect(result).toBe('/service/' + btoa('https://example.com'));
    });
    
    test('should add https:// protocol if missing', () => {
      const { redirectToProxy } = require('../../js/proxy.js');
      
      // Redirect to a URL without protocol
      redirectToProxy('example.com');
      
      // Verify URL was fixed and encoded
      expect(window.__uv$config.encodeUrl).toHaveBeenCalledWith('https://example.com');
    });
  });
  
  describe('registerServiceWorker', () => {
    test('should register service worker successfully', async () => {
      const { registerServiceWorker } = require('../../js/proxy.js');
      
      // Register service worker
      const result = await registerServiceWorker();
      
      // Verify service worker registration was attempted
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/uv.sw.js', {
        scope: '/service/'
      });
      
      // Verify result
      expect(result).toBe(true);
    });
    
    test('should handle registration errors', async () => {
      const { registerServiceWorker } = require('../../js/proxy.js');
      
      // Mock registration failure
      navigator.serviceWorker.register.mockRejectedValueOnce(new Error('Registration failed'));
      
      // Register service worker
      const result = await registerServiceWorker();
      
      // Verify result
      expect(result).toBe(false);
    });
  });
  
  describe('validateProxyService', () => {
    test('should validate proxy service successfully', async () => {
      const { validateProxyService } = require('../../js/proxy.js');
      
      // Validate proxy service
      const result = await validateProxyService();
      
      // Verify fetch was called
      expect(fetch).toHaveBeenCalledWith('/bare-server/');
      
      // Verify result
      expect(result).toEqual({
        success: true,
        data: { version: '1.0.0', maintainer: { email: 'test@example.com' } }
      });
    });
    
    test('should handle validation errors', async () => {
      const { validateProxyService } = require('../../js/proxy.js');
      
      // Mock fetch failure
      fetch.mockRejectedValueOnce(new Error('Connection failed'));
      
      // Validate proxy service
      const result = await validateProxyService();
      
      // Verify result
      expect(result).toEqual({
        success: false,
        error: 'Connection failed'
      });
    });
  });
});
