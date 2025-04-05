/**
 * Authentication utilities for client-side code
 */

/**
 * Check if the user is currently logged in
 * @returns {boolean} Whether user is logged in
 */
function isLoggedIn() {
  return localStorage.getItem('isLoggedIn') === 'true';
}

/**
 * Get the username of the logged in user
 * @returns {string|null} Username or null if not logged in
 */
function getUsername() {
  return isLoggedIn() ? localStorage.getItem('username') : null;
}

/**
 * Log the user out
 * Clears authentication data from local storage and redirects to home page
 */
function logout() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('username');
  localStorage.removeItem('userData'); // Remove temp user data (should use tokens in real app)
  window.location.href = 'index.html';
}

/**
 * Log the user in
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {boolean} Whether login was successful
 */
function login(username, password) {
  // In a real app, this would validate against a server API
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  
  if (userData.username === username && userData.password === password) {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', username);
    return true;
  }
  
  return false;
}

/**
 * Register a new user
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {boolean} Whether registration was successful
 */
function register(username, password) {
  // In a real app, this would send data to a server API
  
  // Simple validation
  if (password.length < 8) {
    return false;
  }
  
  // Store user data (In a real app, this would be sent to a server)
  const userData = { username, password };
  localStorage.setItem('userData', JSON.stringify(userData));
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('username', username);
  
  return true;
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