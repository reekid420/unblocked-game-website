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
    bare: '/bare-server/',
    
    /**
     * Alternative bare server endpoints to try if the main one fails
     * @type {array}
     */
    bareFallbacks: [
        '/bare-server/',
        '/bare-info/'
    ],
    
    /**
     * The encoding used for the proxy.
     * @type {function}
     */
    encodeUrl: self.__uv$encodeUrl,
    
    /**
     * The decoding function used for the proxy.
     * @type {function}
     */
    decodeUrl: self.__uv$decodeUrl,
    
    /**
     * Handler for resource interception
     * @type {string}
     */
    handler: '/uv.handler.js',
    
    /**
     * Bundle path
     * @type {string}
     */
    bundle: '/uv.bundle.js',
    
    /**
     * Config path
     * @type {string}
     */
    config: '/uv.config.js',
    
    /**
     * Service worker path
     * @type {string}
     */
    sw: '/uv.sw.js',
    
    /**
     * Block list for websites that shouldn't be proxied
     * @type {array}
     */
    blockedHosts: [
        // Add sites that shouldn't be proxied here
    ],
    
    // Whether to log debug information
    debug: true,
    
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
    version: '1.0.8',
    
    // Disable CSP for proxy requests
    cspNonce: false,
    
    // Use secure connections for fetch requests
    corsProxies: [
        // Fallback proxies if the primary bare server fails
    ],
    
    /**
     * Try all available bare servers
     * @returns {Promise<string>} The first working bare server URL
     */
    getBareServer: async function() {
        // Start with the main bare server
        let servers = [this.bare, ...this.bareFallbacks];
        
        // Try each server in sequence
        for (const server of servers) {
            try {
                // Basic check to see if the server is available
                const response = await fetch(server, {
                    method: 'GET',
                    credentials: 'omit',
                    mode: 'cors'
                });
                
                if (response.ok) {
                    console.log(`[UV Config] Found working bare server: ${server}`);
                    return server;
                }
            } catch (error) {
                console.warn(`[UV Config] Bare server ${server} failed: ${error.message}`);
                // Continue to the next server
            }
        }
        
        // If we get here, return the default
        console.warn('[UV Config] No working bare servers found, using default');
        return this.bare;
    }
}; 