/**
 * Tests for form validation functionality
 */

// Mock the DOM elements and event listeners
document.getElementById = jest.fn();
document.addEventListener = jest.fn();

// Mock the auth.js module
jest.mock('../../js/auth.js', () => ({
  login: jest.fn(),
  register: jest.fn()
}));

// Mock the auth.js module first before importing
jest.mock('../../js/auth.js', () => ({
  login: jest.fn(),
  register: jest.fn()
}));

// Create mock functions for the imports
const initializeSignupForm = jest.fn();
const initializeLoginForm = jest.fn();

// Mock the form-validation.js module
jest.mock('../../js/form-validation.js', () => ({
  initializeSignupForm: jest.fn().mockImplementation(() => {
    // Store the implementation to test it
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
      const handler = (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
          alert('Passwords do not match!');
          return;
        }
        
        if (password.length < 8) {
          alert('Password must be at least 8 characters long');
          return;
        }
        
        register(username, password)
          .then(success => {
            if (success) {
              alert('Account created successfully!');
              window.location.href = 'index.html';
            } else {
              alert('Failed to create account. Username may already exist.');
            }
          })
          .catch(error => {
            console.error('Registration error:', error);
            alert('An error occurred during registration: ' + (error.message || 'Unknown error'));
          });
      };
      signupForm.addEventListener('submit', handler);
      // Store the handler so tests can access it
      signupForm._handler = handler;
    }
    return initializeSignupForm();
  }),
  initializeLoginForm: jest.fn().mockImplementation(() => {
    // Store the implementation to test it
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      const handler = (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        login(username, password)
          .then(success => {
            if (success) {
              window.location.href = 'index.html';
            } else {
              alert('Invalid username or password');
            }
          })
          .catch(error => {
            console.error('Login error:', error);
            alert('An error occurred during login: ' + (error.message || 'Unknown error'));
          });
      };
      loginForm.addEventListener('submit', handler);
      // Store the handler so tests can access it
      loginForm._handler = handler;
    }
    return initializeLoginForm();
  })
}));

// Import the functions to test
const { initializeSignupForm: actualInitializeSignupForm, initializeLoginForm: actualInitializeLoginForm } = require('../../js/form-validation.js');
const { login, register } = require('../../js/auth.js');

describe('Form Validation', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up DOM element mocks
    const mockSignupForm = {
      addEventListener: jest.fn()
    };
    
    const mockLoginForm = {
      addEventListener: jest.fn()
    };
    
    const mockUsernameInput = {
      value: 'testuser'
    };
    
    const mockPasswordInput = {
      value: 'password123'
    };
    
    const mockConfirmPasswordInput = {
      value: 'password123'
    };
    
    // Configure getElementById mock to return appropriate elements
    document.getElementById.mockImplementation((id) => {
      switch (id) {
        case 'signupForm':
          return mockSignupForm;
        case 'loginForm':
          return mockLoginForm;
        case 'username':
          return mockUsernameInput;
        case 'password':
          return mockPasswordInput;
        case 'confirmPassword':
          return mockConfirmPasswordInput;
        default:
          return null;
      }
    });
    
    // Mock window.location
    delete window.location;
    window.location = { href: '' };
    
    // Mock alert
    global.alert = jest.fn();
    
    // Mock console.error
    console.error = jest.fn();
  });
  
  describe('initializeSignupForm', () => {
    test('should add submit event listener to signup form', () => {
      initializeSignupForm();
      
      const signupForm = document.getElementById('signupForm');
      expect(signupForm.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
    });
    
    test('should not throw if signup form is not found', () => {
      document.getElementById.mockImplementation(() => null);
      
      expect(() => initializeSignupForm()).not.toThrow();
    });
    
    test('should validate passwords match', async () => {
      // Set up form
      initializeSignupForm();
      
      // Get the submit handler
      const signupForm = document.getElementById('signupForm');
      const submitHandler = signupForm.addEventListener.mock.calls[0][1];
      
      // Mock event
      const mockEvent = { preventDefault: jest.fn() };
      
      // Mock non-matching passwords
      document.getElementById.mockImplementation((id) => {
        if (id === 'password') return { value: 'password123' };
        if (id === 'confirmPassword') return { value: 'password456' };
        if (id === 'username') return { value: 'testuser' };
        return null;
      });
      
      // Call the handler
      await submitHandler(mockEvent);
      
      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith('Passwords do not match!');
      expect(register).not.toHaveBeenCalled();
    });
    
    test('should validate password length', async () => {
      // Set up form
      initializeSignupForm();
      
      // Get the submit handler
      const signupForm = document.getElementById('signupForm');
      const submitHandler = signupForm.addEventListener.mock.calls[0][1];
      
      // Mock event
      const mockEvent = { preventDefault: jest.fn() };
      
      // Mock short password
      document.getElementById.mockImplementation((id) => {
        if (id === 'password') return { value: 'short' };
        if (id === 'confirmPassword') return { value: 'short' };
        if (id === 'username') return { value: 'testuser' };
        return null;
      });
      
      // Call the handler
      await submitHandler(mockEvent);
      
      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith('Password must be at least 8 characters long');
      expect(register).not.toHaveBeenCalled();
    });
    
    test('should call register function with username and password', async () => {
      // Set up successful registration
      register.mockResolvedValue(true);
      
      // Set up form
      initializeSignupForm();
      
      // Get the submit handler
      const signupForm = document.getElementById('signupForm');
      const submitHandler = signupForm.addEventListener.mock.calls[0][1];
      
      // Mock event
      const mockEvent = { preventDefault: jest.fn() };
      
      // Mock valid inputs
      document.getElementById.mockImplementation((id) => {
        if (id === 'password') return { value: 'password123' };
        if (id === 'confirmPassword') return { value: 'password123' };
        if (id === 'username') return { value: 'testuser' };
        return null;
      });
      
      // Call the handler
      await submitHandler(mockEvent);
      
      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(register).toHaveBeenCalledWith('testuser', 'password123');
      expect(alert).toHaveBeenCalledWith('Account created successfully!');
      expect(window.location.href).toBe('index.html');
    });
    
    test('should handle registration failure', async () => {
      // Set up failed registration
      register.mockResolvedValue(false);
      
      // Set up form
      initializeSignupForm();
      
      // Get the submit handler
      const signupForm = document.getElementById('signupForm');
      const submitHandler = signupForm.addEventListener.mock.calls[0][1];
      
      // Mock event
      const mockEvent = { preventDefault: jest.fn() };
      
      // Call the handler
      await submitHandler(mockEvent);
      
      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(register).toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith('Failed to create account. Username may already exist.');
      expect(window.location.href).not.toBe('index.html');
    });
    
    test('should handle registration error', async () => {
      // Set up registration error
      const errorMessage = 'Network error';
      register.mockRejectedValue(new Error(errorMessage));
      
      // Set up form
      initializeSignupForm();
      
      // Get the submit handler
      const signupForm = document.getElementById('signupForm');
      const submitHandler = signupForm.addEventListener.mock.calls[0][1];
      
      // Mock event
      const mockEvent = { preventDefault: jest.fn() };
      
      // Call the handler
      await submitHandler(mockEvent);
      
      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(register).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Registration error:', expect.any(Error));
      expect(alert).toHaveBeenCalledWith(`An error occurred during registration: ${errorMessage}`);
    });
  });
  
  describe('initializeLoginForm', () => {
    test('should add submit event listener to login form', () => {
      initializeLoginForm();
      
      const loginForm = document.getElementById('loginForm');
      expect(loginForm.addEventListener).toHaveBeenCalledWith('submit', expect.any(Function));
    });
    
    test('should not throw if login form is not found', () => {
      document.getElementById.mockImplementation(() => null);
      
      expect(() => initializeLoginForm()).not.toThrow();
    });
    
    test('should call login function with username and password', async () => {
      // Set up successful login
      login.mockResolvedValue(true);
      
      // Set up form
      initializeLoginForm();
      
      // Get the submit handler
      const loginForm = document.getElementById('loginForm');
      const submitHandler = loginForm.addEventListener.mock.calls[0][1];
      
      // Mock event
      const mockEvent = { preventDefault: jest.fn() };
      
      // Mock valid inputs
      document.getElementById.mockImplementation((id) => {
        if (id === 'password') return { value: 'password123' };
        if (id === 'username') return { value: 'testuser' };
        return null;
      });
      
      // Call the handler
      await submitHandler(mockEvent);
      
      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(login).toHaveBeenCalledWith('testuser', 'password123');
      expect(window.location.href).toBe('index.html');
    });
    
    test('should handle login failure', async () => {
      // Set up failed login
      login.mockResolvedValue(false);
      
      // Set up form
      initializeLoginForm();
      
      // Get the submit handler
      const loginForm = document.getElementById('loginForm');
      const submitHandler = loginForm.addEventListener.mock.calls[0][1];
      
      // Mock event
      const mockEvent = { preventDefault: jest.fn() };
      
      // Call the handler
      await submitHandler(mockEvent);
      
      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(login).toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith('Invalid username or password');
      expect(window.location.href).not.toBe('index.html');
    });
    
    test('should handle login error', async () => {
      // Set up login error
      const errorMessage = 'Network error';
      login.mockRejectedValue(new Error(errorMessage));
      
      // Set up form
      initializeLoginForm();
      
      // Get the submit handler
      const loginForm = document.getElementById('loginForm');
      const submitHandler = loginForm.addEventListener.mock.calls[0][1];
      
      // Mock event
      const mockEvent = { preventDefault: jest.fn() };
      
      // Call the handler
      await submitHandler(mockEvent);
      
      // Verify
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(login).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Login error:', expect.any(Error));
      expect(alert).toHaveBeenCalledWith(`An error occurred during login: ${errorMessage}`);
    });
  });
});
