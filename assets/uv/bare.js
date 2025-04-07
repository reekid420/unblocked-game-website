// Bare Server Client Implementation
// In a real environment, this would connect to a proper Bare Server
// For documentation, see: https://github.com/tomphttp/specifications/blob/master/BareServer.md

/**
 * BareClient Implementation
 * Used for communicating with the bare server
 */
class BareClient {
    constructor(server) {
        this.server = server || '/bare-server/';
        if (!this.server.endsWith('/')) {
            this.server += '/';
        }
        
        this.isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');
        this.isChrome = typeof navigator !== 'undefined' && navigator.userAgent.includes('Chrome');
        this.browserInfo = {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            isFirefox: this.isFirefox,
            isChrome: this.isChrome
        };
        
        // Initialize server connection state
        this.status = {
            connected: false,
            lastCheck: null,
            error: null
        };
        
        console.log(`[Bare] Client initialized with server: ${this.server}`);
        console.log(`[Bare] Browser detected: ${this.isFirefox ? 'Firefox' : this.isChrome ? 'Chrome' : 'Other'}`);
        
        // Try to ping the server to verify connectivity
        this.ping().catch(err => {
            console.warn(`[Bare] Server connectivity check failed: ${err.message}`);
            this.status.error = err.message;
        });
    }

    /**
     * Fetch a resource through the bare server
     * @param {string} url - URL to fetch
     * @param {Object} [init={}] - Fetch initialization options
     * @returns {Promise<Response>} - Proxied response
     */
    async fetch(url, init = {}) {
        // Parse URL for logging and processing
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
            console.log(`[Bare] Fetching URL: ${url}`);
            console.log(`[Bare] URL details: protocol=${parsedUrl.protocol}, host=${parsedUrl.host}, path=${parsedUrl.pathname}`);
        } catch(e) {
            console.error(`[Bare] Invalid URL format: ${url}`);
            throw new Error(`Invalid URL: ${e.message}`);
        }
        
        if (!this.server) {
            throw new Error('Bare server not specified');
        }
        
        // Create request options
        const requestHeaders = new Headers(init.headers || {});
        
        // Add essential headers if missing
        if (!requestHeaders.has('x-bare-host')) {
            requestHeaders.set('x-bare-host', parsedUrl.hostname);
        }
        
        if (!requestHeaders.has('x-bare-protocol')) {
            requestHeaders.set('x-bare-protocol', parsedUrl.protocol.replace(':', ''));
        }
        
        if (!requestHeaders.has('x-bare-path')) {
            requestHeaders.set('x-bare-path', parsedUrl.pathname + parsedUrl.search);
        }
        
        if (!requestHeaders.has('x-bare-port')) {
            requestHeaders.set('x-bare-port', parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80'));
        }

        // Add debug headers to identify the client
        requestHeaders.set('x-bare-client-version', '1.0.0');
        requestHeaders.set('x-bare-client-browser', this.isFirefox ? 'firefox' : this.isChrome ? 'chrome' : 'other');
        requestHeaders.set('x-bare-is-proxy-request', 'true');
        
        // Get the headers from the original request
        const headers = {};
        if (init.headers) {
            if (init.headers instanceof Headers) {
                for (const [key, value] of init.headers.entries()) {
                    headers[key.toLowerCase()] = value;
                }
            } else if (Array.isArray(init.headers)) {
                for (const [key, value] of init.headers) {
                    headers[key.toLowerCase()] = value;
                }
            } else {
                for (const key in init.headers) {
                    headers[key.toLowerCase()] = init.headers[key];
                }
            }
        }
        
        // Add important headers
        if (!headers.origin && parsedUrl.origin) headers.origin = parsedUrl.origin;
        if (!headers.referer && parsedUrl.href) headers.referer = parsedUrl.href;
        
        requestHeaders.set('x-bare-headers', JSON.stringify(headers));
        requestHeaders.set('x-bare-method', init.method || 'GET');
        
        // Add required headers for Firefox
        if (this.isFirefox) {
            requestHeaders.set('x-bare-forward-headers', JSON.stringify([
                'accept',
                'accept-language',
                'user-agent',
                'content-type'
            ]));
        }
        
        console.log(`[Bare] Request headers:`, Object.fromEntries(requestHeaders.entries()));
        
        // Create fetch options
        const options = {
            method: init.method === 'GET' || init.method === 'HEAD' ? init.method : 'POST',
            headers: requestHeaders,
            credentials: 'omit',
            mode: 'cors',
            redirect: init.redirect || 'follow'
        };
        
        // Add body for non-GET requests
        if (init.body && options.method !== 'GET' && options.method !== 'HEAD') {
            if (typeof init.body === 'string') {
                options.body = init.body;
            } else if (init.body instanceof FormData || init.body instanceof URLSearchParams) {
                options.body = init.body;
            } else if (init.body instanceof Blob || init.body instanceof ArrayBuffer) {
                options.body = init.body;
            } else {
                try {
                    options.body = JSON.stringify(init.body);
                    if (!requestHeaders.has('content-type')) {
                        requestHeaders.set('content-type', 'application/json');
                    }
                } catch (e) {
                    console.warn(`[Bare] Could not stringify body: ${e.message}`);
                }
            }
        }
        
        console.log(`[Bare] Sending ${options.method} request to ${this.server}`);
        
        try {
            const response = await fetch(this.server, options);
            
            console.log(`[Bare] Response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                console.error(`[Bare] Server returned error: ${response.status}`);
                
                // Try to get error details
                try {
                    const errorText = await response.clone().text();
                    console.error(`[Bare] Error details: ${errorText}`);
                } catch (e) {
                    console.error(`[Bare] Could not read error details: ${e.message}`);
                }
                
                if (response.status === 404) {
                    throw new Error('Bare server returned 404 - endpoint not found');
                } else if (response.status === 400) {
                    throw new Error('Bare server returned 400 - bad request');
                } else if (response.status === 403) {
                    throw new Error('Bare server returned 403 - forbidden');
                } else if (response.status === 429) {
                    throw new Error('Bare server returned 429 - too many requests');
                } else if (response.status === 500) {
                    throw new Error('Bare server returned 500 - internal server error');
                }
            }
            
            return response;
        } catch (error) {
            console.error(`[Bare] Fetch error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create a WebSocket connection through the bare server
     * @param {string} url - WebSocket URL to connect to
     * @param {string|string[]} [protocols] - WebSocket protocols
     * @returns {WebSocket} - WebSocket connection
     */
    createWebSocket(url, protocols) {
        if (!this.server) {
            throw new Error('Bare server not specified');
        }
        
        console.log(`[Bare] Creating WebSocket connection to ${url}`);
        
        // Parse the URL
        const parsedUrl = new URL(url);
        
        // Create bare server WebSocket URL
        let wsUrl = this.server;
        
        // Convert HTTP/HTTPS to WS/WSS if needed
        if (wsUrl.startsWith('http:')) {
            wsUrl = 'ws:' + wsUrl.substring(5);
        } else if (wsUrl.startsWith('https:')) {
            wsUrl = 'wss:' + wsUrl.substring(6);
        }
        
        // Firefox requires a different approach for WebSocket URLs
        if (this.isFirefox) {
            console.log('[Bare] Using Firefox-compatible WebSocket connection');
            
            // Make sure wsUrl ends with /
            if (!wsUrl.endsWith('/')) {
                wsUrl += '/';
            }
            
            // Create a standard URL with query parameters for Firefox
            const socketUrl = new URL(wsUrl);
            socketUrl.searchParams.set('bare_host', parsedUrl.hostname);
            socketUrl.searchParams.set('bare_protocol', parsedUrl.protocol.replace(':', ''));
            socketUrl.searchParams.set('bare_path', parsedUrl.pathname + parsedUrl.search);
            socketUrl.searchParams.set('bare_port', parsedUrl.port || (parsedUrl.protocol === 'wss:' ? '443' : '80'));
            
            console.log(`[Bare] Firefox WebSocket URL: ${socketUrl.toString()}`);
            return new WebSocket(socketUrl, protocols);
        }
        
        // Standard Chrome/other browsers approach
        // Add ? or & depending on if the URL already has search params
        wsUrl += wsUrl.includes('?') ? '&' : '?';
        
        // Add WebSocket parameters
        wsUrl += `bare_host=${encodeURIComponent(parsedUrl.hostname)}`;
        wsUrl += `&bare_protocol=${encodeURIComponent(parsedUrl.protocol.replace(':', ''))}`;
        wsUrl += `&bare_path=${encodeURIComponent(parsedUrl.pathname + parsedUrl.search)}`;
        wsUrl += `&bare_port=${encodeURIComponent(parsedUrl.port || (parsedUrl.protocol === 'wss:' ? '443' : '80'))}`;
        
        console.log(`[Bare] Standard WebSocket URL: ${wsUrl}`);
        return new WebSocket(wsUrl, protocols);
    }
    
    /**
     * Check server connectivity
     * @returns {Promise<Object>} - Server metadata
     */
    async ping() {
        try {
            console.log(`[Bare] Pinging server: ${this.server}`);
            
            // Use the actual server directly, not trying to append v3
            const pingEndpoint = this.server;
            
            // Create headers with required bare headers
            const headers = new Headers({
                'x-bare-url': 'https://example.com',
                'x-bare-host': 'example.com',
                'x-bare-protocol': 'https',
                'x-bare-path': '/',
                'x-bare-port': '443',
                'x-bare-headers': JSON.stringify({
                    'accept': 'application/json'
                }),
                'x-bare-forward-headers': JSON.stringify([
                    'accept',
                    'accept-language'
                ])
            });
            
            if (this.isFirefox) {
                headers.set('user-agent', navigator.userAgent);
            }
            
            // Add debug headers
            headers.set('x-bare-client-version', '1.0.0');
            headers.set('x-bare-client-browser', this.isFirefox ? 'firefox' : this.isChrome ? 'chrome' : 'other');
            headers.set('x-bare-is-proxy-request', 'true');
            
            // Use OPTIONS method for ping to avoid potential CORS issues
            const response = await fetch(pingEndpoint, {
                method: 'OPTIONS',
                headers: headers,
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (!response.ok) {
                console.error(`[Bare] Server responded with status ${response.status}`);
                try {
                    const errorText = await response.text();
                    console.error(`[Bare] Error details: ${errorText}`);
                } catch {}
                throw new Error(`Server responded with status ${response.status}`);
            }
            
            let data;
            try {
                // Try to parse as JSON first
                const text = await response.text();
                
                // Check if the response is empty
                if (!text || text.trim() === '') {
                    console.warn('[Bare] Empty response from server, using default response');
                    data = { status: 'ok', versions: [3], language: 'NodeJS' };
                } else {
                    try {
                        // Try to parse the text as JSON
                        data = JSON.parse(text);
                        console.log(`[Bare] Server reached successfully: version=${data.versions ? data.versions[0] : 'unknown'}`);
                    } catch (jsonError) {
                        console.warn(`[Bare] Failed to parse JSON: ${jsonError.message}, response: "${text}"`);
                        // If text contains "running" or other indicators, create a synthetic response
                        if (text.includes('running') || text.includes('ok')) {
                            data = { status: 'ok', versions: [3], language: 'NodeJS' };
                        } else {
                            throw jsonError;
                        }
                    }
                }
            } catch (parseError) {
                console.error(`[Bare] Error parsing response: ${parseError.message}`);
                throw parseError;
            }
            
            // Update status
            this.status.connected = true;
            this.status.lastCheck = new Date();
            this.status.error = null;
            
            return data;
        } catch (error) {
            console.error(`[Bare] Server ping failed: ${error.message}`);
            
            // Try fallback ping to /bare-info/ endpoint
            try {
                console.log('[Bare] Trying fallback ping to /bare-info/ endpoint');
                const fallbackResponse = await fetch('/bare-info/', {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                if (fallbackResponse.ok) {
                    console.log('[Bare] Fallback ping successful');
                    this.status.connected = true;
                    this.status.lastCheck = new Date();
                    this.status.error = null;
                    
                    // Parse JSON if possible, otherwise return simple object
                    try {
                        return await fallbackResponse.json();
                    } catch {
                        return { status: 'ok', fallback: true };
                    }
                }
            } catch (fallbackError) {
                console.error(`[Bare] Fallback ping also failed: ${fallbackError.message}`);
            }
            
            // Update status
            this.status.connected = false;
            this.status.lastCheck = new Date();
            this.status.error = error.message;
            
            throw error;
        }
    }
    
    /**
     * Get current server status
     * @returns {Object} - Current server status
     */
    getStatus() {
        return { ...this.status, browserInfo: this.browserInfo };
    }
}

// Make BareClient available globally
if (typeof window !== 'undefined') {
    window.BareClient = BareClient;
    window.bareClient = window.bareClient || new BareClient('/bare-server/');
    console.log('[Bare] Client globally registered');
}

// Ping the server to verify it's working
window.addEventListener('load', () => {
    window.bareClient.ping().catch(err => {
        console.warn('[Bare] Server ping failed, but this might be normal depending on server configuration');
    });
}); 