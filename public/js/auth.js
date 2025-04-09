/**
 * Authentication utilities for client-side code
 */
import apiClient from './api-client.js';

/**
 * Check if the user is currently logged in
 * @returns {boolean} Whether user is logged in
 */
function isLoggedIn() {
  return apiClient.isLoggedIn();
}

/**
 * Get the username of the logged in user
 * @returns {string|null} Username or null if not logged in
 */
function getUsername() {
  return localStorage.getItem('username');
}

/**
 * Log the user out
 * Clears authentication data from local storage and redirects to home page
 */
function logout() {
  apiClient.clearToken();
  localStorage.removeItem('username');
  window.location.href = 'index.html';
}

/**
 * Log the user in
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise<boolean>} Whether login was successful
 */
async function login(username, password) {
  try {
    const response = await apiClient.login({ username, password });
    if (response.user) {
      localStorage.setItem('username', response.user.username);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

/**
 * Register a new user
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise<boolean>} Whether registration was successful
 */
async function register(username, password) {
  // Simple validation
  if (password.length < 8) {
    return false;
  }
  
  try {
    const response = await apiClient.register({ username, password });
    if (response.user) {
      localStorage.setItem('username', response.user.username);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Registration error:', error);
    return false;
  }
}

/**
 * Update UI elements based on authentication status
 * This handles common UI elements like login/logout buttons
 */
function updateUIForAuthStatus() {
  const loggedIn = isLoggedIn();
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  
  if (loggedIn) {
    // Change login to logout
    if (loginBtn) {
      loginBtn.textContent = 'Logout';
      loginBtn.href = '#';
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault();
        logout();
      });
    }
    
    // Hide signup button
    if (signupBtn) {
      signupBtn.style.display = 'none';
    }
  } else {
    // Reset login button
    if (loginBtn) {
      loginBtn.textContent = 'Login';
      loginBtn.href = 'login.html';
    }
    
    // Show signup button
    if (signupBtn) {
      signupBtn.style.display = '';
    }
  }
}

// Export authentication utilities
export { 
  isLoggedIn, 
  getUsername, 
  logout, 
  login, 
  register, 
  updateUIForAuthStatus 
}; 