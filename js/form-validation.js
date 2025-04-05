/**
 * Form validation functionality for login and signup forms
 */
import { login, register } from './auth.js';

/**
 * Initialize the signup form validation and submission
 */
function initializeSignupForm() {
  const signupForm = document.getElementById('signupForm');
  
  if (signupForm) {
    signupForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      // Basic validation
      if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
      }
      
      // Password strength check
      if (password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
      }
      
      // Call the register function
      if (register(username, password)) {
        alert('Account created successfully!');
        window.location.href = 'index.html';
      } else {
        alert('Failed to create account');
      }
    });
  }
}

/**
 * Initialize the login form validation and submission
 */
function initializeLoginForm() {
  const loginForm = document.getElementById('loginForm');
  
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      // Call the login function
      if (login(username, password)) {
        window.location.href = 'index.html';
      } else {
        alert('Invalid username or password');
      }
    });
  }
}

// Initialize forms when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initializeSignupForm();
  initializeLoginForm();
});

export { initializeSignupForm, initializeLoginForm }; 