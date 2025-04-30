// Utility functions converted from legacy utils.js

/**
 * Sanitize user input to prevent XSS attacks
 * @param input - Raw user input
 * @returns Sanitized input
 */
export function sanitizeInput(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Validate URL format and security
 * @param url - URL to validate
 * @returns Whether URL is valid
 */
export function validateUrl(url: string): boolean {
  // Basic URL validation
  if (!url) return false;
  // Must be http or https
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a string is likely a URL
 * @param val - String to check
 * @returns Whether string is likely a URL
 */
export function isUrl(val: string = ''): boolean {
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
