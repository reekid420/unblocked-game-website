/**
 * Utility functions for client-side code
 */

/**
 * Sanitize user input to prevent XSS attacks
 * @param {string} input - Raw user input
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Validate URL format and security
 * @param {string} url - URL to validate
 * @returns {boolean} Whether URL is valid
 */
function validateUrl(url) {
  // Basic URL validation
  if (!url) return false;
  
  // Must be http or https
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }
  
  try {
    // Check if it's a valid URL
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if a string is likely a URL
 * @param {string} val - String to check
 * @returns {boolean} Whether string is likely a URL
 */
function isUrl(val = '') {
  if (!val) return false;
  
  // If it starts with http:// or https://, it's likely a URL
  if (val.startsWith('http://') || val.startsWith('https://')) {
    return true;
  }
  
  // Check for common domain patterns
  // This is a simple check - could be expanded for more accuracy
  const commonTLDs = ['.com', '.org', '.net', '.io', '.edu', '.gov', '.co'];
  if (commonTLDs.some(tld => val.includes(tld))) {
    return true;
  }
  
  return false;
}

// Export utilities
export { sanitizeInput, validateUrl, isUrl }; 