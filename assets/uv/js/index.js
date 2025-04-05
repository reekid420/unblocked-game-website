// Ultraviolet Service Initialization
window.addEventListener('DOMContentLoaded', () => {
    // Initialize search functionality
    const searchbar = document.querySelector('#searchbar');
    if (searchbar) {
        searchbar.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const query = searchbar.value;
                if (query.trim()) {
                    processQuery(query);
                }
            }
        });
    }
    
    // Initialize the UV form
    const uvForm = document.getElementById('uv-form');
    if (uvForm) {
        uvForm.addEventListener('submit', (event) => {
            event.preventDefault();
            
            const address = document.getElementById('uv-address');
            const searchEngine = document.getElementById('uv-search-engine');
            
            const query = address.value.trim();
            if (!query) return;
            
            // Check if it's a URL or search query
            if (isUrl(query)) {
                hire(query);
            } else {
                // Use the search engine value with the query
                hire(`${searchEngine.value}${encodeURIComponent(query)}`);
            }
        });
    }
});

// Process search query or URL
function processQuery(query) {
    // Check if it's a URL or search query
    if (isUrl(query)) {
        // Ensure URL has protocol
        if (!query.startsWith('http://') && !query.startsWith('https://')) {
            query = 'https://' + query;
        }
        // Use our proxy function to load the URL
        hire(query);
    } else {
        // If not a URL, perform Google search
        hire('https://www.google.com/search?q=' + encodeURIComponent(query));
    }
}

// Check if input is likely a URL
function isUrl(val = '') {
    // Checks for domain-like patterns (.com, .net, etc.)
    if (/^(https?:\/\/)?([^\s.]+\.)+[^\s.]{2,}/.test(val) 
        || /^(https?:\/\/)?(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])/.test(val)) {
        return true;
    }
    return false;
} 