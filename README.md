# Study Resources Center

A website that provides educational games, chat rooms, and AI chat help for students. The site also includes a web proxy feature that allows students to access educational resources that might be restricted on school networks.

## Features

- **Educational Games**: A collection of games that promote learning and critical thinking
- **Study Groups**: Chat rooms where students can collaborate on homework
- **Homework Help**: AI-powered chat assistant to help with homework questions
- **Web Proxy**: Access educational websites even on restricted networks

## How It Works

The website uses Ultraviolet, a web proxy built on service workers, to bypass content filters. This enables students to access important educational resources and tools that may be otherwise blocked on school networks.

### Proxy Architecture

1. **Client-Side Proxy**: The site uses Ultraviolet to proxy requests directly from the browser
2. **XOR Encoding**: URLs are encoded to bypass pattern-matching filters
3. **Service Workers**: Handle intercepting and modifying requests/responses

## Working with the Proxy

### How the Proxy Works

Our web proxy is implemented using Ultraviolet, a powerful client-side proxy that works through service workers. Here's how it functions:

1. **URL Encoding**: When a user enters a URL, it gets encoded using Base64 to prevent detection.
2. **Service Worker Interception**: The UV service worker intercepts outgoing requests that match our proxy pattern.
3. **Request Handling**: The service worker modifies headers and routes the request through our bare server.
4. **Content Rewriting**: When responses are received, Ultraviolet rewrites HTML, CSS, and JavaScript to ensure all resources load correctly through the proxy.
5. **Client-Side Rendering**: The modified content is rendered in the browser, creating a seamless browsing experience.

### Setting Up the Proxy

To set up the proxy components:

1. **Bare Server Setup**:
   ```bash
   npm install @tomphttp/bare-server-node
   ```

2. **Create a bare server file** (e.g., `bare-server.js`):
   ```javascript
   const { createBareServer } = require('@tomphttp/bare-server-node');
   const http = require('http');
   const path = require('path');
   const fs = require('fs');
   
   const bareServer = createBareServer('/bare/');
   const port = process.env.PORT || 8080;
   
   const server = http.createServer((req, res) => {
     if (bareServer.shouldRoute(req)) {
       bareServer.routeRequest(req, res);
     } else {
       // Serve static files
       const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
       try {
         const data = fs.readFileSync(filePath);
         res.end(data);
       } catch (err) {
         res.statusCode = 404;
         res.end('404 Not Found');
       }
     }
   });
   
   server.on('upgrade', (req, socket, head) => {
     if (bareServer.shouldRoute(req)) {
       bareServer.routeUpgrade(req, socket, head);
     } else {
       socket.end();
     }
   });
   
   server.listen(port, () => {
     console.log(`Server running at http://localhost:${port}/`);
   });
   ```

3. **Run the server**:
   ```bash
   node bare-server.js
   ```

### Using the Proxy

1. **Open the website** in your browser
2. **Enter a URL** in the proxy search bar
3. **Click "Go"** or press Enter
4. The **proxied content** will load in a new tab

### Security Considerations

- The proxy implementation is for educational purposes only
- All traffic should be secured with HTTPS in production
- Consider implementing access controls if deploying for a wider audience
- Regularly update dependencies to patch security vulnerabilities

### Customizing the Proxy

You can customize the proxy behavior by modifying these files:

- `assets/uv/uv.config.js` - Main configuration settings
- `assets/uv/uv.sw.js` - Service worker implementation
- `assets/uv/bare.js` - Bare server client
- `assets/uv/wm.js` - URL rewriting mechanisms

## Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/unblocked-game-website.git
   cd unblocked-game-website
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database (PostgreSQL with Prisma):
   - See detailed instructions in [DB_SETUP.md](DB_SETUP.md)
   - Create a PostgreSQL database
   - Configure the connection in `.env`
   - Run Prisma migrations: `npm run prisma:migrate`

4. Start the server:
   ```bash
   npm start
   ```

5. Open your browser and navigate to `http://localhost:8080`

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Proxy**: Ultraviolet
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)

## Database Structure

The application uses PostgreSQL with Prisma ORM to store:

- **User accounts and authentication data**
- **Chat messages and rooms**
- **Game save data**
- **Proxy usage history**

For more details on the database setup and schema, see [DB_SETUP.md](DB_SETUP.md).

## Educational Purpose

This tool is designed specifically for educational purposes to help students access learning resources. It is not intended to bypass school security systems for non-educational purposes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.