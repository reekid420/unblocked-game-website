// Check if user is logged in
document.addEventListener('DOMContentLoaded', function() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    
    if (isLoggedIn === 'true') {
        // Change login to logout
        if (loginBtn) {
            loginBtn.textContent = 'Logout';
            loginBtn.href = '#';
            loginBtn.addEventListener('click', function(e) {
                e.preventDefault();
                logout();
            });
        }
        
        // Hide signup button
        if (signupBtn) {
            signupBtn.style.display = 'none';
        }
    }
    
    // Check if page requires auth
    const currentPage = window.location.pathname.split('/').pop();
    if ((currentPage === 'chat.html' || currentPage === 'ai-chat.html') && isLoggedIn !== 'true') {
        // Redirect to login
        window.location.href = 'login.html';
    }
});

// Logout function
function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    window.location.href = 'index.html';
}

// Form validation for signup and login
if (document.getElementById('signupForm')) {
    document.getElementById('signupForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Basic validation
        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }
        
        // Password strength check
        if (password.length < 8) {
            alert('Password must be at least 8 characters long');
            return;
        }
        
        // Store user data (In a real app, this would be sent to a server)
        const userData = {
            username,
            password // In a real app, this should be hashed
        };
        
        // For demo purposes only - in a real app this would be stored on a server
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', username);
        
        alert('Account created successfully!');
        window.location.href = 'index.html';
    });
}

if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // In a real app, this would validate against a server
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        if (userData.username === username && userData.password === password) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('username', username);
            window.location.href = 'index.html';
        } else {
            alert('Invalid username or password');
        }
    });
}

// Chat functionality
if (document.getElementById('chatForm')) {
    const chatMessages = document.querySelector('.chat-messages');
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const username = localStorage.getItem('username') || 'Anonymous';
    
    // Function to add a message to the chat
    function addMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // When form is submitted
    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addMessage(`${username}: ${message}`, 'user-message');
        
        // Clear input
        messageInput.value = '';
        
        // In a real app, you would send this to a server
        // and receive messages from other users
        // For demo, we'll simulate other users
        setTimeout(() => {
            addMessage('Other User: This is a response!', 'other-message');
        }, 1000);
    });
}

// AI Chat functionality
if (document.getElementById('aiChatForm')) {
    const chatMessages = document.querySelector('.chat-messages');
    const chatForm = document.getElementById('aiChatForm');
    const messageInput = document.getElementById('messageInput');
    const username = localStorage.getItem('username') || 'Anonymous';
    
    // Function to add a message to the chat
    function addMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // When form is submitted
    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addMessage(`You: ${message}`, 'user-message');
        
        // Clear input
        messageInput.value = '';
        
        // In a real app, you would call the Gemini API here
        // For demo, we'll simulate AI responses
        setTimeout(() => {
            const aiResponses = [
                "I'm an AI assistant, how can I help you?",
                "That's an interesting question. Let me think about that.",
                "Here's some information that might help you.",
                "I'm sorry, I don't have that information.",
                "Could you provide more details about your question?"
            ];
            const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
            addMessage(`AI: ${randomResponse}`, 'ai-message');
        }, 1000);
    });
}

// Utility function to sanitize user input to prevent XSS
function sanitizeInput(input) {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

// Utility function to validate URLs
function validateUrl(url) {
  // Basic URL validation
  if (!url) return false;
  
  // Must be http or https
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return false;
  }
  
  try {
    // Check if it's a valid URL
    new URL(url);
    
    // Whitelist allowed domains for proxy (optional - remove if not needed)
    const allowedDomains = [
      'google.com',
      'youtube.com',
      'wikipedia.org',
      'quizlet.com',
      'khanacademy.org'
    ];
    
    const hostname = new URL(url).hostname;
    const domain = hostname.split('.').slice(-2).join('.');
    
    // If we have a whitelist, check against it
    // This is optional and can be removed if you want to allow all domains
    // return allowedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
    
    return true;
  } catch (e) {
    return false;
  }
}

// UV Proxy Functionality
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('uv-form');
  
  if (form) {
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      
      const address = document.getElementById('uv-address');
      const searchEngine = document.getElementById('uv-search-engine');
      
      // Sanitize input
      const sanitizedValue = sanitizeInput(address.value);
      
      if (!sanitizedValue) {
        alert('Please enter a URL or search term');
        return;
      }
      
      // Determine if the input is a URL or search term
      let url = sanitizedValue.trim();
      if (!isUrl(url)) {
        // If it's a search term, use the search engine
        const sanitizedSearchQuery = encodeURIComponent(url);
        url = searchEngine.value + sanitizedSearchQuery;
      } else if (!(url.startsWith('https://') || url.startsWith('http://'))) {
        url = 'https://' + url;
      }
      
      // Validate the URL for security
      if (!validateUrl(url)) {
        alert('Invalid or disallowed URL. Please enter a valid web address.');
        return;
      }
      
      // In a real UV implementation, this would use the service worker
      // to proxy the request - here we're simulating it
      try {
        console.log('Proxying: ' + url);
        
        // Encode the URL with the UV encoder
        // In a real implementation, this would be properly handled 
        // by the UV bundle
        const encodedUrl = btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        
        // Create the proxied URL
        const proxyUrl = '/service/' + encodedUrl;
        
        // In a real implementation, this would go through the service worker
        // For demo purposes, we'll open a new window with a simulation
        // Removed UV proxy simulation: now handled by Python proxy API.
// window.open('/proxy-simulation.html?url=' + encodeURIComponent(url), '_blank');
// To proxy, use: fetch('/api/proxy', { method: 'POST', body: ... }) or redirect as needed.
        
        // Clear the input field
        address.value = '';
      } catch (err) {
        console.error('Failed to proxy request:', err);
        alert('Failed to proxy the request. Please try again.');
      }
    });
  }
  
  // Helper function to check if a string is a URL
  function isUrl(val = '') {
    // Check if the value contains a dot (simplified check)
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+/.test(val) || 
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(val)) {
      return true;
    }
    return false;
  }
});

// Security-enhanced chat functionality
// Replaces any insecure direct references with secure code
document.addEventListener('DOMContentLoaded', function() {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  
  if (chatForm && chatInput && chatMessages) {
    chatForm.addEventListener('submit', function(event) {
      event.preventDefault();
      
      // Get and sanitize user input
      const messageText = sanitizeInput(chatInput.value.trim());
      
      if (messageText) {
        // Create message element securely
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        
        // Add timestamp
        const timestamp = new Date().toLocaleTimeString();
        
        // Set content safely using textContent (not innerHTML)
        messageElement.textContent = `[${timestamp}] You: ${messageText}`;
        
        // Append to chat
        chatMessages.appendChild(messageElement);
        
        // Clear input
        chatInput.value = '';
        
        // Auto-scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Simulate response (in a real app, this would come from a server)
        setTimeout(function() {
          const responseElement = document.createElement('div');
          responseElement.className = 'message system-message';
          responseElement.textContent = `[${new Date().toLocaleTimeString()}] System: Thanks for your message!`;
          chatMessages.appendChild(responseElement);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 1000);
      }
    });
  }
});

// Secure authentication (using a more secure alternative to localStorage)
// This implementation uses sessionStorage and does not store passwords in plain text
if (typeof window.secureAuth === 'undefined') {
  window.secureAuth = {
    // Login function that doesn't store raw passwords
    login: function(username, password) {
      // In a real implementation, this would send credentials to a server
      // for verification. The server would return a token if valid.
      // This is a simplified example where we create a basic token
      
      if (!username || !password) return false;
      
      // Create a timestamp to expire sessions
      const expiry = Date.now() + (8 * 60 * 60 * 1000); // 8 hours
      
      // Store only a session token, never the password
      const sessionData = {
        username: sanitizeInput(username),
        token: btoa(username + ':' + Date.now()), // This is not secure, just a demo
        expiry: expiry
      };
      
      // Use sessionStorage instead of localStorage for authentication data
      // SessionStorage is cleared when the browser session ends
      sessionStorage.setItem('authData', JSON.stringify(sessionData));
      
      return true;
    },
    
    // Register a new user
    register: function(username, password) {
      if (!username || !password) return false;
      
      // In a real implementation, this would send user data to a server
      // and create a database record. Here we're just using localStorage
      // for demo purposes.
      
      // Password validation
      if (password.length < 8) {
        return false;
      }
      
      // Create a simple user record for demo purposes
      // DO NOT store passwords like this in production!
      const hashedPassword = btoa(password); // This is NOT secure, just for demo
      
      // Store the user data
      try {
        const users = JSON.parse(localStorage.getItem('users') || '{}');
        
        // Check if username already exists
        if (users[username]) {
          return false;
        }
        
        // Add the new user
        users[username] = {
          username: username,
          passwordHash: hashedPassword,
          created: Date.now()
        };
        
        localStorage.setItem('users', JSON.stringify(users));
        
        // Login the user
        return this.login(username, password);
      } catch (e) {
        console.error('Registration error:', e);
        return false;
      }
    },
    
    // Check if user is logged in
    isLoggedIn: function() {
      try {
        const sessionData = JSON.parse(sessionStorage.getItem('authData'));
        
        if (!sessionData) return false;
        
        // Check if token is expired
        if (sessionData.expiry < Date.now()) {
          this.logout();
          return false;
        }
        
        return true;
      } catch (e) {
        return false;
      }
    },
    
    // Get username of logged in user
    getUsername: function() {
      try {
        const sessionData = JSON.parse(sessionStorage.getItem('authData'));
        return sessionData && this.isLoggedIn() ? sessionData.username : null;
      } catch (e) {
        return null;
      }
    },
    
    // Logout function
    logout: function() {
      sessionStorage.removeItem('authData');
    }
  };
}

// Initialize login/signup forms with secure handling
document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  
  if (loginForm) {
    loginForm.addEventListener('submit', function(event) {
      event.preventDefault();
      
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      
      // Validate inputs
      if (!username || !password) {
        alert('Please fill in all fields');
        return;
      }
      
      if (window.secureAuth.login(username, password)) {
        alert('Login successful!');
        window.location.href = '/'; // Redirect to homepage
      } else {
        alert('Login failed. Please check your credentials.');
      }
    });
  }
  
  if (signupForm) {
    signupForm.addEventListener('submit', function(event) {
      event.preventDefault();
      
      const username = document.getElementById('signup-username').value;
      const password = document.getElementById('signup-password').value;
      const confirmPassword = document.getElementById('signup-confirm-password').value;
      
      // Validate inputs
      if (!username || !password || !confirmPassword) {
        alert('Please fill in all fields');
        return;
      }
      
      if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
      }
      
      // Password strength check
      if (password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
      }
      
      // Register the user with secureAuth
      if (window.secureAuth.register(username, password)) {
        alert('Account created and logged in!');
        window.location.href = '/'; // Redirect to homepage
      } else {
        alert('Failed to create account. Username may already exist.');
      }
    });
  }
  
  // Update UI based on login status
  const updateUIForAuthStatus = function() {
    const loginLinks = document.querySelectorAll('.login-link');
    const signupLinks = document.querySelectorAll('.signup-link');
    const profileLinks = document.querySelectorAll('.profile-link');
    const logoutLinks = document.querySelectorAll('.logout-link');
    const usernameElements = document.querySelectorAll('.username-display');
    
    if (window.secureAuth.isLoggedIn()) {
      // User is logged in
      loginLinks.forEach(link => link.style.display = 'none');
      signupLinks.forEach(link => link.style.display = 'none');
      profileLinks.forEach(link => link.style.display = 'inline-block');
      logoutLinks.forEach(link => link.style.display = 'inline-block');
      
      const username = window.secureAuth.getUsername();
      usernameElements.forEach(el => {
        el.textContent = username;
        el.style.display = 'inline-block';
      });
    } else {
      // User is not logged in
      loginLinks.forEach(link => link.style.display = 'inline-block');
      signupLinks.forEach(link => link.style.display = 'inline-block');
      profileLinks.forEach(link => link.style.display = 'none');
      logoutLinks.forEach(link => link.style.display = 'none');
      
      usernameElements.forEach(el => {
        el.style.display = 'none';
      });
    }
  };
  
  // Add logout functionality
  document.querySelectorAll('.logout-link').forEach(link => {
    link.addEventListener('click', function(event) {
      event.preventDefault();
      window.secureAuth.logout();
      updateUIForAuthStatus();
      window.location.href = '/'; // Redirect to homepage
    });
  });
  
  // Initial UI update
  updateUIForAuthStatus();
}); 