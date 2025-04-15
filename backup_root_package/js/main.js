/**
 * Main entry point for client-side JavaScript
 * Imports and initializes all modules based on the current page
 */

import { updateUIForAuthStatus, isLoggedIn } from './auth.js';
import { initializeChat } from './chat.js';
import { initializeAiChat } from './ai-chat.js';
import { initializeProxy } from './proxy.js';
import { initializeLoginForm, initializeSignupForm } from './form-validation.js';
import apiClient from './api-client.js';

/**
 * Initialize the application based on the current page
 */
function initializeApp() {
  // Common initialization for all pages
  updateUIForAuthStatus();
  
  // Check if page requires authentication
  const currentPage = window.location.pathname.split('/').pop();
  if ((currentPage === 'chat.html' || currentPage === 'ai-chat.html') && !isLoggedIn()) {
    // Redirect to login
    window.location.href = 'login.html';
    return;
  }
  
  // Make API client available globally for inline scripts
  window.apiClient = apiClient;
  
  // Specific page initializations are handled by their respective modules
  // The module will check if it's on the appropriate page before initializing
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Export for potential use in other modules
export { initializeApp };