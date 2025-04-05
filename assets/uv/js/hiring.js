// Ultraviolet URL Proxy Handler

/**
 * Redirects the user to the specified URL through the Ultraviolet proxy
 * This is the main function used to bypass web filters
 * @param {string} url - The URL to access through the proxy
 */
function hire(url) {
    // Ensure URL is properly formatted
    if (!isValidURL(url)) {
        console.error('Invalid URL provided:', url);
        return;
    }

    try {
        // Get Ultraviolet instance
        const uv = window.uv;
        if (!uv) {
            console.error('Ultraviolet proxy not initialized');
            return;
        }

        // Encode the URL using Ultraviolet
        const encodedURL = uv.encode(url);

        // Navigate to the proxied URL
        // The prefix is defined in uv.config.js
        window.location.href = __uv$config.prefix + encodedURL;
    } catch (err) {
        console.error('Error proxying URL:', err);
        alert('Unable to access the requested website at this time.');
    }
}

/**
 * Validates that a URL is properly formatted
 * @param {string} url - The URL to validate
 * @returns {boolean} - Whether the URL is valid
 */
function isValidURL(url) {
    try {
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        // Test if URL is valid
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
} 