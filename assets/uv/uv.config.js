/**
 * Ultraviolet Configuration
 * This file contains settings for the Ultraviolet proxy
 */
self.__uv$config = {
    /**
     * The prefix for UV (Ultraviolet) resources.
     * @type {string}
     */
    prefix: '/service/',
    
    /**
     * The bare server endpoint.
     * @type {string}
     */
    bare: '/bare/',
    
    /**
     * The encoding used for the proxy.
     * @type {function}
     */
    encodeUrl: (url) => {
        return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    },
    
    /**
     * The decoding function used for the proxy.
     * @type {function}
     */
    decodeUrl: (url) => {
        return atob(url.replace(/-/g, '+').replace(/_/g, '/'));
    },
    
    /**
     * Handler for resource interception
     * @type {string}
     */
    handler: '/assets/uv/uv.handler.js',
    
    /**
     * Bundle path
     * @type {string}
     */
    bundle: '/assets/uv/uv.bundle.js',
    
    /**
     * Config path
     * @type {string}
     */
    config: '/assets/uv/uv.config.js',
    
    /**
     * Service worker path
     * @type {string}
     */
    sw: '/assets/uv/uv.sw.js',
    
    /**
     * Block list for websites that shouldn't be proxied
     * @type {array}
     */
    blockedHosts: [
        // Add sites that shouldn't be proxied here
    ],
    
    // Whether to log debug information
    debug: false,
    
    // A simple placeholder dummy cookie
    cookie: {
        // Cookie domain (defaults to host)
        domain: location.hostname,
        // Secure policy
        secure: location.protocol === 'https:',
        // Makes cookie only accessible by server
        httpOnly: true,
    },
    
    // Worker URL for service worker
    client: '/uv/uv.client.js',
    
    // Version of Ultraviolet for cache busting
    version: '1.0.7'
}; 