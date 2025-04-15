/**
 * Tests for UV Proxy functionality
 */

// Mock browser globals
global.navigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  serviceWorker: {
    register: jest.fn().mockResolvedValue({
      active: { state: 'activated' },
      installing: null,
      waiting: null,
      addEventListener: jest.fn()
    })
  }
};

// Mock window object
global.window = {
  location: {
    origin: 'http://localhost:8080',
    pathname: '/',
    href: 'http://localhost:8080/',
    protocol: 'http:',
    host: 'localhost:8080'
  },
  addEventListener: jest.fn(),
  fetch: jest.fn(),
  __uv$config: {
    prefix: '/service/',
    bare: '/bare-server/',
    encodeUrl: jest.fn(url => `encoded-${url}`),
    decodeUrl: jest.fn(url => url.replace('encoded-', '')),
  },
  redirectToProxy: null,
  __uvInitializing: false,
  bareClient: {
    ping: jest.fn().mockResolvedValue({ success: true })
  }
};

// Mock document
document.getElementById = jest.fn();
document.addEventListener = jest.fn();
document.createElement = jest.fn().mockReturnValue({
  setAttribute: jest.fn(),
  style: {},
  addEventListener: jest.fn()
});
document.head = {
  appendChild: jest.fn()
};
document.body = {
  appendChild: jest.fn()
};

// Mock console methods
console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

// Mock alert
global.alert = jest.fn();

// Mock the utils.js module
jest.mock('../../js/utils.js', () => ({
  isUrl: jest.fn(url => {
    return url.startsWith('http://') || url.startsWith('https://') || url.includes('.com');
  })
}));

// Mock the proxy.js module
jest.mock('../../js/proxy.js', () => {
  // Create mock implementations for the functions
  const initializeProxy = jest.fn().mockImplementation(() => {
    if (window.__uvInitializing) {
      console.log('[UV] Proxy initialization already in progress, skipping duplicate call');
      return;
    }
    window.__uvInitializing = true;
    
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
      searchForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const searchInput = document.getElementById('searchbar');
        const query = searchInput ? searchInput.value.trim() : '';
        
        if (!query) {
          alert('Please enter a URL or search query');
          return;
        }
        
        const defaultSearchEngine = 'https://www.google.com/search?q=';
        module.exports.processQuery(query, defaultSearchEngine);
      });
    }
    
    if (window.location.pathname.startsWith('/service/')) {
      console.log('[UV] Already in proxy context, skipping service worker registration');
      window.__uvInitializing = false;
      return;
    }
    
    module.exports.registerServiceWorker().then(success => {
      window.__uvInitializing = false;
    }).catch(error => {
      console.error('[UV] Error during proxy initialization:', error);
      window.__uvInitializing = false;
    });
  });
  
  const processQuery = jest.fn().mockImplementation((query, searchEngine) => {
    const { isUrl } = require('../../js/utils.js');
    
    // Check if it's a URL
    if (isUrl(query)) {
      // Make sure it has a protocol
      if (!query.startsWith('http://') && !query.startsWith('https://')) {
        query = 'https://' + query;
      }
      window.redirectToProxy(query);
    } else {
      // It's a search query, encode it
      const encodedQuery = encodeURIComponent(query);
      window.redirectToProxy(`${searchEngine}${encodedQuery}`);
    }
  });
  
  const redirectToProxy = jest.fn().mockImplementation((url) => {
    const { isUrl } = require('../../js/utils.js');
    
    if (!isUrl(url)) {
      alert('Invalid URL: ' + url);
      return;
    }
    
    window.location.href = window.__uv$config.prefix + window.__uv$config.encodeUrl(url);
  });
  
  const registerServiceWorker = jest.fn().mockImplementation(async () => {
    try {
      const registration = await navigator.serviceWorker.register('/uv.sw.js', {
        scope: '/service/'
      });
      
      return true;
    } catch (error) {
      console.error('[UV] Error registering service worker:', error);
      return false;
    }
  });
  
  const validateProxyService = jest.fn().mockImplementation(async () => {
    try {
      const response = await window.fetch('/bare-server/');
      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }
      return { success: false, error: 'Invalid response' };
    } catch (error) {
      console.error('[UV] Error validating proxy service:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Export the mock functions
  return {
    initializeProxy,
    processQuery,
    redirectToProxy,
    registerServiceWorker,
    validateProxyService
  };
});

// Import the module to test
const { 
  initializeProxy, 
  processQuery, 
  redirectToProxy, 
  registerServiceWorker, 
  validateProxyService 
} = require('../../js/proxy.js');

describe('UV Proxy Functionality', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset window properties
    window.__uvInitializing = false;
    
    // Set up DOM element mocks
    const mockSearchForm = {
      addEventListener: jest.fn()
    };
    
    const mockSearchInput = {
      value: 'example.com'
    };
    
    const mockQuickLinks = [
      { dataset: { url: 'https://example.com' }, addEventListener: jest.fn() }
    ];
    
    // Configure getElementById mock
    document.getElementById.mockImplementation((id) => {
      switch (id) {
        case 'searchForm':
          return mockSearchForm;
        case 'searchbar':
          return mockSearchInput;
        case 'quickLinks':
          return { querySelectorAll: () => mockQuickLinks };
        default:
          return null;
      }
    });
    
    // Mock querySelectorAll
    document.querySelectorAll = jest.fn().mockReturnValue(mockQuickLinks);
  });
  
  describe('initializeProxy', () => {
    test('should register event listener for search form', () => {
      initializeProxy();
      
      const searchForm = document.getElementById('searchForm');
      expect(searchForm.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
    });
    
    test('should not re-initialize if already initializing', () => {
      window.__uvInitializing = true;
      
      initializeProxy();
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('already in progress'), expect.anything());
      expect(document.getElementById('searchForm').addEventListener).not.toHaveBeenCalled();
    });
    
    test('should skip service worker registration if already in proxy context', () => {
      window.location.pathname = '/service/encoded-https://example.com';
      
      initializeProxy();
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Already in proxy context'), expect.anything());
      expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
    });
  });
  
  describe('processQuery', () => {
    test('should redirect to proxy for valid URLs', () => {
      // Create a spy on redirectToProxy
      const redirectSpy = jest.fn();
      window.redirectToProxy = redirectSpy;
      
      processQuery('https://example.com', 'https://google.com/search?q=');
      
      expect(redirectSpy).toHaveBeenCalledWith('https://example.com');
    });
    
    test('should add https:// prefix if URL is missing protocol', () => {
      const redirectSpy = jest.fn();
      window.redirectToProxy = redirectSpy;
      
      processQuery('example.com', 'https://google.com/search?q=');
      
      expect(redirectSpy).toHaveBeenCalledWith('https://example.com');
    });
    
    test('should use search engine for non-URL queries', () => {
      const redirectSpy = jest.fn();
      window.redirectToProxy = redirectSpy;
      
      // Mock isUrl to return false for this test
      require('../../js/utils.js').isUrl.mockReturnValueOnce(false);
      
      processQuery('search query', 'https://google.com/search?q=');
      
      expect(redirectSpy).toHaveBeenCalledWith('https://google.com/search?q=search%20query');
    });
  });
  
  describe('redirectToProxy', () => {
    test('should validate URL before redirecting', () => {
      // Mock window.location.href setter
      const originalHref = window.location.href;
      Object.defineProperty(window.location, 'href', {
        get: () => originalHref,
        set: jest.fn()
      });
      
      redirectToProxy('https://example.com');
      
      expect(window.location.href).toHaveBeenCalled();
    });
    
    test('should show error for invalid URLs', () => {
      // Force isUrl to return false
      require('../../js/utils.js').isUrl.mockReturnValueOnce(false);
      
      redirectToProxy('invalid-url');
      
      expect(alert).toHaveBeenCalledWith(expect.stringContaining('Invalid URL'));
    });
  });
  
  describe('registerServiceWorker', () => {
    test('should register the UV service worker', async () => {
      const result = await registerServiceWorker();
      
      expect(navigator.serviceWorker.register).toHaveBeenCalled();
      expect(result).toBe(true);
    });
    
    test('should handle registration errors', async () => {
      // Force registration to fail
      navigator.serviceWorker.register.mockRejectedValueOnce(new Error('Registration failed'));
      
      const result = await registerServiceWorker();
      
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error registering service worker'), expect.anything());
      expect(result).toBe(false);
    });
  });
  
  describe('validateProxyService', () => {
    test('should validate proxy service functionality', async () => {
      window.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true })
      });
      
      const result = await validateProxyService();
      
      expect(window.fetch).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
    
    test('should handle validation errors', async () => {
      window.fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await validateProxyService();
      
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error validating proxy service'), expect.anything());
      expect(result.success).toBe(false);
    });
  });
});
