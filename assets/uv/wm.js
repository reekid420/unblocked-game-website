// Web Modules for UV proxy
// This handles URL rewriting and other basic proxy functions
// In a real implementation, this would be more comprehensive

class URLRewriter {
    constructor(config) {
        this.config = config || {
            prefix: '/service/',
            bare: '/bare/',
            handler: '/uv/uv.handler.js',
            bundle: '/uv/uv.bundle.js',
            config: '/uv/uv.config.js',
            sw: '/uv/uv.sw.js',
        };
    }

    // Rewrite a URL to go through the proxy
    rewrite(url, context = 'default') {
        console.log(`[URLRewriter] Rewriting URL: ${url} (context: ${context})`);
        
        try {
            // Make sure URL has a protocol
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            // Basic URL encoding - in a real implementation, this would be more complex
            const encoded = btoa(url);
            
            // Return proxied URL
            return this.config.prefix + encoded;
        } catch (error) {
            console.error('[URLRewriter] Error rewriting URL:', error);
            return url; // Return original URL on error
        }
    }

    // Restore original URL from a proxied one
    restore(url) {
        console.log(`[URLRewriter] Restoring URL: ${url}`);
        
        try {
            // Check if URL is proxied
            if (url.startsWith(this.config.prefix)) {
                // Extract encoded part
                const encoded = url.slice(this.config.prefix.length);
                
                // Decode
                return atob(encoded);
            }
            
            // Return original if not proxied
            return url;
        } catch (error) {
            console.error('[URLRewriter] Error restoring URL:', error);
            return url; // Return original URL on error
        }
    }
}

// Register globally
window.URLRewriter = URLRewriter;
window.urlRewriter = new URLRewriter(); 