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
    signupForm.addEventListener('submit', async function(e) {
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
      
      try {
        // Call the register function (now async)
        const success = await register(username, password);
        if (success) {
          alert('Account created successfully!');
          window.location.href = 'index.html';
        } else {
          alert('Failed to create account. Username may already exist.');
        }
      } catch (error) {
        console.error('Registration error:', error);
        alert('An error occurred during registration: ' + (error.message || 'Unknown error'));
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
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      try {
        // Call the login function (now async)
        const success = await login(username, password);
        if (success) {
          window.location.href = 'index.html';
        } else {
          alert('Invalid username or password');
        }
      } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login: ' + (error.message || 'Unknown error'));
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