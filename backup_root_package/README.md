# Unblocked Game Website with UV Proxy

This project is an educational platform with study resources and proxy capabilities. It allows users to access educational content, play games, and browse the web securely.

## Features

- Web proxy service using UltraViolet
- Game collection
- Study resources
- Modern UI

## Setup Instructions

1. Clone the repository

```bash
git clone https://github.com/rekeid420/unblocked-game-website.git
cd unblocked-game-website
```

2. Install dependencies

```bash
npm install
```

3. Start the server

```bash
npm start
```

4. Visit http://localhost:8080 in your browser

## Project Structure

```
├── assets/
│   ├── js/
│   ├── uv/          # UltraViolet proxy files
│   └── images/
├── js/              # Client-side JavaScript
├── public/          # Static files served by Express
├── server.js        # Main server implementation
└── package.json     # Project dependencies
```

## Configuration

The UV proxy is configured in the following files:

- `assets/uv/uv.config.js` - Main configuration for UV
- `assets/uv/bare.js` - Bare server client
- `assets/uv/uv.sw.js` - Service worker implementation

## Troubleshooting

### Common Issues

1. **Service worker registration fails**
   - Make sure your browser supports service workers
   - Check console logs for specific errors
   - Try clearing the browser cache and service workers

2. **Bare server connectivity issues**
   - Verify the server is running properly
   - Check network tab in browser dev tools
   - Look for 404/500 errors in server logs
   - Ensure proper paths are configured in `uv.config.js`

3. **CORS errors**
   - The server is configured to handle CORS, but some external services may block requests
   - Check server logs for CORS-related errors

4. **Infinite refresh loops**
   - Clear browser cache and cookies
   - Delete all service worker registrations and reload
   - Check service worker code for recursive fetch patterns

### Debug Logging

Enable verbose logging by setting the `debug` option to `true` in `uv.config.js`.

## Bare Server API Endpoints

- `/bare-server/` - Main proxy endpoint
- `/bare-info/` - Server information endpoint
- `/health` - Health check endpoint

## License

MIT