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
        // Access the Ultraviolet config
        if (typeof __uv$config === 'undefined') {
            console.error('Ultraviolet config not found');
            alert('Proxy configuration not loaded. Please reload the page and try again.');
            return;
        }
        
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        // Use built-in encodeURL function
        const encodedURL = __uv$config.encodeUrl(url);
        
        // Navigate to the proxied URL
        console.log('Redirecting to proxied URL:', url);
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