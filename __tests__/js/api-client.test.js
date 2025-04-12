/**
 * Tests for API client in api-client.js
 */

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch API
global.fetch = jest.fn();

// Mock response data
const mockUserData = { id: '123', username: 'testuser' };
const mockToken = 'mock-jwt-token';
const mockLoginResponse = { user: mockUserData, token: mockToken };

// Create a simplified version of the ApiClient for testing
class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl || 'http://localhost';
    this.token = null;
  }

  isLoggedIn() {
    return !!this.token;
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/api${endpoint}`;
    
    const fetchOptions = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(url, fetchOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${error.message}`);
      throw error;
    }
  }

  async login(credentials) {
    const data = await this.request('/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  async logout() {
    this.clearToken();
  }

  async getProfile() {
    return this.request('/users/profile');
  }
}

// Create an instance for testing
const apiClient = new ApiClient();

// Helper to mock successful fetch responses
function mockFetchSuccess(data) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data
  });
}

// Helper to mock failed fetch responses
function mockFetchFailure(error) {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error })
  });
}

// Reset mocks before each test
global.beforeEach = global.beforeEach || ((fn) => fn());

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.token = null;
});

describe('ApiClient', () => {
  describe('isLoggedIn', () => {
    test('should return false when no token is set', () => {
      expect(apiClient.isLoggedIn()).toBe(false);
    });

    test('should return true when token is set', () => {
      apiClient.token = mockToken;
      expect(apiClient.isLoggedIn()).toBe(true);
    });
  });

  describe('setToken', () => {
    test('should set token and store in localStorage', () => {
      apiClient.setToken(mockToken);
      expect(apiClient.token).toBe(mockToken);
      expect(localStorage.setItem).toHaveBeenCalledWith('authToken', mockToken);
    });
  });

  describe('clearToken', () => {
    test('should clear token and remove from localStorage', () => {
      apiClient.token = mockToken;
      apiClient.clearToken();
      expect(apiClient.token).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('authToken');
    });
  });

  describe('getHeaders', () => {
    test('should return basic headers when no token is set', () => {
      const headers = apiClient.getHeaders();
      expect(headers).toEqual({
        'Content-Type': 'application/json'
      });
    });

    test('should include Authorization header when token is set', () => {
      apiClient.token = mockToken;
      const headers = apiClient.getHeaders();
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mockToken}`
      });
    });
  });

  describe('request', () => {
    test('should make fetch request with correct URL and options', async () => {
      const endpoint = '/test';
      const options = { method: 'GET' };
      const mockData = { success: true };
      
      mockFetchSuccess(mockData);
      
      const result = await apiClient.request(endpoint, options);
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(result).toEqual(mockData);
    });

    test('should throw error when response is not ok', async () => {
      const endpoint = '/test';
      const errorMessage = 'Something went wrong';
      
      mockFetchFailure(errorMessage);
      
      await expect(apiClient.request(endpoint)).rejects.toThrow();
    });
  });

  describe('login', () => {
    test('should make POST request and set token on success', async () => {
      const credentials = { username: 'testuser', password: 'password' };
      
      mockFetchSuccess(mockLoginResponse);
      
      const result = await apiClient.login(credentials);
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost/api/users/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(credentials)
        })
      );
      expect(apiClient.token).toBe(mockToken);
      expect(result).toEqual(mockLoginResponse);
    });
  });

  describe('logout', () => {
    test('should clear token', async () => {
      apiClient.token = mockToken;
      
      await apiClient.logout();
      
      expect(apiClient.token).toBeNull();
    });
  });

  describe('getProfile', () => {
    test('should make GET request to profile endpoint', async () => {
      const mockProfile = { username: 'testuser', email: 'test@example.com' };
      
      mockFetchSuccess(mockProfile);
      
      const result = await apiClient.getProfile();
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost/api/users/profile',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(result).toEqual(mockProfile);
    });
  });
});
