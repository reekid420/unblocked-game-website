// Form validation functionality for login and signup forms (converted from legacy form-validation.js)
// NOTE: In React, validation and submission logic is typically handled inside components, but for migration, we preserve standalone functions.

/**
 * Validate signup form fields
 * @returns Error message if invalid, or null if valid
 */
export function validateSignup(username: string, password: string, confirmPassword: string): string | null {
  if (password !== confirmPassword) {
    return 'Passwords do not match!';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  // Add more validation as needed
  return null;
}

/**
 * Validate login form fields
 * @returns Error message if invalid, or null if valid
 */
export function validateLogin(username: string, password: string): string | null {
  if (!username || !password) {
    return 'Username and password are required.';
  }
  // Add more validation as needed
  return null;
}

// NOTE: Actual form submission and DOM manipulation should be handled in React components.
// These functions are for validation logic only, to be called from component event handlers.
