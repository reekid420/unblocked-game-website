/**
 * Ultraviolet Handler - Mock Implementation
 * 
 * Note: This is a mock implementation for demonstration purposes.
 * In a real application, you would use the actual Ultraviolet handler from:
 * https://github.com/titaniumnetwork-dev/Ultraviolet
 */

// This file would normally contain complex logic for handling different
// types of content (HTML, JS, CSS) for the proxy. This is a simplified version.

class UVHandler {
  constructor(config) {
    this.config = config || {};
    console.log('UV Handler initialized with config:', this.config);
  }
  
  /**
   * Process an HTML document for proxying
   * @param {string} html - The HTML content to process
   * @param {string} baseUrl - The base URL for resolving relative URLs
   * @returns {string} - The processed HTML
   */
  rewriteHtml(html, baseUrl) {
    console.log('UV Handler: Rewriting HTML from', baseUrl);
    // In a real implementation, this would modify HTML to work through the proxy
    return html;
  }
  
  /**
   * Process JavaScript for proxying
   * @param {string} js - The JavaScript content to process
   * @param {string} baseUrl - The base URL for resolving relative URLs
   * @returns {string} - The processed JavaScript
   */
  rewriteJs(js, baseUrl) {
    console.log('UV Handler: Rewriting JS from', baseUrl);
    // In a real implementation, this would modify JavaScript to work through the proxy
    return js;
  }
  
  /**
   * Process CSS for proxying
   * @param {string} css - The CSS content to process
   * @param {string} baseUrl - The base URL for resolving relative URLs
   * @returns {string} - The processed CSS
   */
  rewriteCss(css, baseUrl) {
    console.log('UV Handler: Rewriting CSS from', baseUrl);
    // In a real implementation, this would modify CSS to work through the proxy
    return css;
  }
  
  /**
   * Process URLs for proxying
   * @param {string} url - The URL to process
   * @returns {string} - The processed URL
   */
  rewriteUrl(url) {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    
    // In a real implementation, this would properly rewrite URLs to work through the proxy
    const prefix = this.config.prefix || '/service/';
    const encodedUrl = this.config.encodeUrl ? this.config.encodeUrl(url) : btoa(url);
    
    return prefix + encodedUrl;
  }
}

// Export the handler
self.UVHandler = UVHandler;

// Initialize if in browser context
if (typeof window !== 'undefined') {
  window.uvHandler = new UVHandler(window.__uv$config || {});
  console.log('UV Handler initialized in browser');
}

/**
 * Handle opaque responses from the bare server
 * @param {Response} response - The opaque response
 * @returns {Response} - A new response with proper CORS headers
 */
function handleOpaqueResponse(response) {
  const headers = new Headers(response.headers);
  
  // Add CORS headers
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  
  // Create a new Response with the same body but with CORS headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

/**
 * Process response from the bare server
 * @param {Response} response - The response from the bare server
 * @returns {Promise<Response>} - The processed response
 */
async function processBareResponse(response) {
  // Check if the response is opaque
  if (response.type === 'opaque' || response.status === 0) {
    console.warn('Received opaque response from bare server, applying CORS fix');
    return handleOpaqueResponse(response);
  }
  
  // Check if the response has proper CORS headers
  if (!response.headers.has('Access-Control-Allow-Origin')) {
    console.warn('Response missing CORS headers, adding them');
    return handleOpaqueResponse(response);
  }
  
  return response;
} 