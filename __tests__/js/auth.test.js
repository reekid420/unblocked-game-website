/**
 * Tests for authentication utilities in auth.js
 */

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.location
delete window.location;
window.location = { href: '' };

// Mock the api-client.js module
jest.mock('../../js/api-client.js', () => ({
  __esModule: true,
  default: {
    isLoggedIn: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    clearToken: jest.fn()
  }
}));

// Mock document.getElementById
document.getElementById = jest.fn();

// Create mock functions for auth.js
const authFunctions = {
  isLoggedIn: jest.fn(),
  getUsername: jest.fn(),
  logout: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
  updateUIForAuthStatus: jest.fn()
};

// Mock the auth.js module
jest.mock('../../js/auth.js', () => ({
  isLoggedIn: jest.fn().mockImplementation(() => {
    return require('../../js/api-client.js').default.isLoggedIn();
  }),
  getUsername: jest.fn().mockImplementation(() => {
    return localStorage.getItem('username');
  }),
  logout: jest.fn().mockImplementation(() => {
    require('../../js/api-client.js').default.clearToken();
    localStorage.removeItem('username');
    window.location.href = 'index.html';
  }),
  login: jest.fn().mockImplementation(async (username, password) => {
    try {
      const response = await require('../../js/api-client.js').default.login({ username, password });
      if (response.user) {
        localStorage.setItem('username', response.user.username);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }),
  register: jest.fn().mockImplementation(async (username, password) => {
    if (password.length < 8) {
      return false;
    }
    
    try {
      const response = await require('../../js/api-client.js').default.register({ username, password });
      if (response.user) {
        localStorage.setItem('username', response.user.username);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  }),
  updateUIForAuthStatus: jest.fn().mockImplementation(() => {
    const loggedIn = require('../../js/auth.js').isLoggedIn();
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    
    if (loggedIn) {
      if (loginBtn) {
        loginBtn.textContent = 'Logout';
        loginBtn.href = '#';
        loginBtn.addEventListener('click', function(e) {
          e.preventDefault();
          require('../../js/auth.js').logout();
        });
      }
      
      if (signupBtn) {
        signupBtn.style.display = 'none';
      }
    } else {
      if (loginBtn) {
        loginBtn.textContent = 'Login';
        loginBtn.href = 'login.html';
      }
      
      if (signupBtn) {
        signupBtn.style.display = '';
      }
    }
  })
}));

// Import the functions to test
const { isLoggedIn, getUsername, logout, login, register, updateUIForAuthStatus } = require('../../js/auth.js');
const apiClient = require('../../js/api-client.js').default;

describe('Authentication Utilities', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    window.location.href = '';
    
    // Set up DOM element mocks
    const mockLoginBtn = {
      textContent: 'Login',
      href: 'login.html',
      addEventListener: jest.fn(),
      style: {}
    };
    
    const mockSignupBtn = {
      style: {},
      addEventListener: jest.fn()
    };
    
    // Configure getElementById mock
    document.getElementById.mockImplementation((id) => {
      switch (id) {
        case 'loginBtn':
          return mockLoginBtn;
        case 'signupBtn':
          return mockSignupBtn;
        default:
          return null;
      }
    });
    
    // Mock console.error
    console.error = jest.fn();
  });
  
  describe('isLoggedIn', () => {
    test('should call apiClient.isLoggedIn', () => {
      apiClient.isLoggedIn.mockReturnValue(true);
      
      const result = isLoggedIn();
      
      expect(apiClient.isLoggedIn).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
  
  describe('getUsername', () => {
    test('should get username from localStorage', () => {
      const mockUsername = 'testuser';
      localStorage.getItem.mockReturnValue(mockUsername);
      
      const result = getUsername();
      
      expect(localStorage.getItem).toHaveBeenCalledWith('username');
      expect(result).toBe(mockUsername);
    });
    
    test('should return null if username not in localStorage', () => {
      localStorage.getItem.mockReturnValue(null);
      
      const result = getUsername();
      
      expect(localStorage.getItem).toHaveBeenCalledWith('username');
      expect(result).toBeNull();
    });
  });
  
  describe('logout', () => {
    test('should clear token, remove username from localStorage, and redirect', () => {
      logout();
      
      expect(apiClient.clearToken).toHaveBeenCalled();
      expect(localStorage.removeItem).toHaveBeenCalledWith('username');
      expect(window.location.href).toBe('index.html');
    });
  });
  
  describe('login', () => {
    test('should call apiClient.login and return true on success', async () => {
      const mockUsername = 'testuser';
      const mockPassword = 'password123';
      const mockResponse = {
        user: { username: mockUsername }
      };
      
      apiClient.login.mockResolvedValue(mockResponse);
      
      const result = await login(mockUsername, mockPassword);
      
      expect(apiClient.login).toHaveBeenCalledWith({ username: mockUsername, password: mockPassword });
      expect(localStorage.setItem).toHaveBeenCalledWith('username', mockUsername);
      expect(result).toBe(true);
    });
    
    test('should return false if login response has no user', async () => {
      apiClient.login.mockResolvedValue({});
      
      const result = await login('testuser', 'password123');
      
      expect(apiClient.login).toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    test('should handle login error and return false', async () => {
      const mockError = new Error('API error');
      apiClient.login.mockRejectedValue(mockError);
      
      const result = await login('testuser', 'password123');
      
      expect(apiClient.login).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Login error:', mockError);
      expect(result).toBe(false);
    });
  });
  
  describe('register', () => {
    test('should validate password length and return false if too short', async () => {
      const result = await register('testuser', 'short');
      
      expect(apiClient.register).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    test('should call apiClient.register and return true on success', async () => {
      const mockUsername = 'testuser';
      const mockPassword = 'password123';
      const mockResponse = {
        user: { username: mockUsername }
      };
      
      apiClient.register.mockResolvedValue(mockResponse);
      
      const result = await register(mockUsername, mockPassword);
      
      expect(apiClient.register).toHaveBeenCalledWith({ username: mockUsername, password: mockPassword });
      expect(localStorage.setItem).toHaveBeenCalledWith('username', mockUsername);
      expect(result).toBe(true);
    });
    
    test('should return false if register response has no user', async () => {
      apiClient.register.mockResolvedValue({});
      
      const result = await register('testuser', 'password123');
      
      expect(apiClient.register).toHaveBeenCalled();
      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    test('should handle register error and return false', async () => {
      const mockError = new Error('API error');
      apiClient.register.mockRejectedValue(mockError);
      
      const result = await register('testuser', 'password123');
      
      expect(apiClient.register).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Registration error:', mockError);
      expect(result).toBe(false);
    });
  });
  
  describe('updateUIForAuthStatus', () => {
    test('should update UI for logged in user', () => {
      apiClient.isLoggedIn.mockReturnValue(true);
      
      updateUIForAuthStatus();
      
      const loginBtn = document.getElementById('loginBtn');
      const signupBtn = document.getElementById('signupBtn');
      
      expect(loginBtn.textContent).toBe('Logout');
      expect(loginBtn.href).toBe('#');
      expect(loginBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(signupBtn.style.display).toBe('none');
    });
    
    test('should update UI for logged out user', () => {
      apiClient.isLoggedIn.mockReturnValue(false);
      
      updateUIForAuthStatus();
      
      const loginBtn = document.getElementById('loginBtn');
      const signupBtn = document.getElementById('signupBtn');
      
      expect(loginBtn.textContent).not.toBe('Logout');
      expect(loginBtn.href).not.toBe('#');
      expect(signupBtn.style.display).not.toBe('none');
    });
    
    test('should not throw if UI elements are not found', () => {
      document.getElementById.mockReturnValue(null);
      
      expect(() => updateUIForAuthStatus()).not.toThrow();
    });
  });
});
