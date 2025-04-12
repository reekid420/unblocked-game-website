/**
 * Jest setup file for frontend tests
 * This file runs before each test and sets up the DOM environment
 */

// Mock browser globals for Node.js environment
global.localStorage = {
  getItem: jest.fn().mockImplementation((key) => {
    return this[key] || null;
  }),
  setItem: jest.fn().mockImplementation((key, value) => {
    this[key] = value;
  }),
  removeItem: jest.fn().mockImplementation((key) => {
    delete this[key];
  }),
  clear: jest.fn().mockImplementation(() => {
    Object.keys(this).forEach(key => {
      if (typeof this[key] !== 'function') {
        delete this[key];
      }
    });
  })
};

global.sessionStorage = {
  getItem: jest.fn().mockImplementation((key) => {
    return this[key] || null;
  }),
  setItem: jest.fn().mockImplementation((key, value) => {
    this[key] = value;
  }),
  removeItem: jest.fn().mockImplementation((key) => {
    delete this[key];
  }),
  clear: jest.fn().mockImplementation(() => {
    Object.keys(this).forEach(key => {
      if (typeof this[key] !== 'function') {
        delete this[key];
      }
    });
  })
};

// Mock fetch with better implementation
global.fetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer()),
    headers: new Map(),
    status: 200,
    statusText: 'OK'
  })
);

global.alert = jest.fn();
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock window object for Node.js environment
global.window = {
  location: {
    href: 'http://localhost/',
    pathname: '/',
    origin: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    search: '',
    hash: '',
    reload: jest.fn(),
    replace: jest.fn(),
    assign: jest.fn()
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  fetch: global.fetch,
  alert: global.alert,
  console: global.console,
  navigator: {
    userAgent: 'jest-test-environment',
    language: 'en-US',
    serviceWorker: {
      register: jest.fn().mockResolvedValue({
        scope: '/service/',
        active: { state: 'activated' }
      }),
      ready: Promise.resolve({
        active: { state: 'activated' }
      })
    }
  },
  __uv$config: {
    prefix: '/service/',
    encodeUrl: jest.fn(url => btoa(url)),
    decodeUrl: jest.fn(encoded => atob(encoded))
  }
};

// Create a more complete document mock
const createElementMock = (tag) => {
  const element = {
    tagName: tag.toUpperCase(),
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    className: '',
    id: '',
    attributes: {},
    style: {},
    children: [],
    innerHTML: '',
    outerHTML: `<${tag}></${tag}>`,
    textContent: '',
    value: '',
    checked: false,
    getAttribute: jest.fn(attr => element.attributes[attr]),
    setAttribute: jest.fn((attr, value) => { element.attributes[attr] = value; }),
    appendChild: jest.fn(child => { element.children.push(child); return child; }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    click: jest.fn(),
    cloneNode: jest.fn(() => createElementMock(tag)),
    closest: jest.fn(),
    matches: jest.fn(),
    querySelectorAll: jest.fn().mockReturnValue([]),
    querySelector: jest.fn().mockReturnValue(null)
  };
  return element;
};

// Mock document object for Node.js environment
global.document = {
  getElementById: jest.fn(id => {
    const element = createElementMock('div');
    element.id = id;
    return element;
  }),
  querySelector: jest.fn(selector => {
    const element = createElementMock('div');
    return element;
  }),
  querySelectorAll: jest.fn(selector => []),
  createElement: jest.fn(tag => createElementMock(tag)),
  createTextNode: jest.fn(text => ({ nodeType: 3, textContent: text })),
  body: createElementMock('body'),
  head: createElementMock('head'),
  documentElement: createElementMock('html'),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  cookie: '',
  location: global.window.location
};

// Mock XMLHttpRequest
global.XMLHttpRequest = function() {
  return {
    open: jest.fn(),
    send: jest.fn(),
    setRequestHeader: jest.fn(),
    readyState: 4,
    status: 200,
    response: {},
    responseText: '',
    onreadystatechange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
};

// Mock WebSocket
global.WebSocket = function() {
  return {
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: 1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };
};

// Mock crypto for Node.js environment
global.crypto = {
  subtle: {
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    sign: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    verify: jest.fn().mockResolvedValue(true),
    generateKey: jest.fn().mockResolvedValue({}),
    importKey: jest.fn().mockResolvedValue({}),
    exportKey: jest.fn().mockResolvedValue({})
  },
  getRandomValues: jest.fn(array => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  })
};

// Mock URL and URLSearchParams
global.URL = class URL {
  constructor(url, base) {
    this.href = url;
    this.origin = 'http://localhost';
    this.protocol = 'http:';
    this.host = 'localhost';
    this.hostname = 'localhost';
    this.port = '';
    this.pathname = '/';
    this.search = '';
    this.hash = '';
    this.searchParams = new URLSearchParams();
  }
  
  toString() {
    return this.href;
  }
};

global.URLSearchParams = class URLSearchParams {
  constructor(init) {
    this.params = new Map();
    if (typeof init === 'string') {
      init.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        this.append(key, value);
      });
    }
  }
  
  append(key, value) {
    this.params.set(key, value);
  }
  
  get(key) {
    return this.params.get(key);
  }
  
  has(key) {
    return this.params.has(key);
  }
  
  toString() {
    return Array.from(this.params.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }
};

// Setup for handling ES modules in Jest
jest.mock('socket.io-client', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    io: {
      engine: {
        close: jest.fn()
      }
    }
  }));
});

// Handle process.env for tests
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key';
}
if (!process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = 'test-api-key';
}
if (!process.env.PYTHON_PROXY_URL) {
  process.env.PYTHON_PROXY_URL = 'http://localhost:8000';
}

// Silence console errors during tests
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.('Warning:') || args[0]?.includes?.('Error:')) {
    return;
  }
  originalConsoleError(...args);
};

// Clean up mocks after each test
global.afterEach = global.afterEach || ((fn) => fn());

afterEach(() => {
  jest.clearAllMocks();
});
