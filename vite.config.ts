import { defineConfig } from 'vite';
// @ts-ignore
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/proxy': 'http://localhost:8080',
      '/topics': 'http://localhost:8080',
      '/chat': 'http://localhost:8080',
      '/register': 'http://localhost:8080',
      '/login': 'http://localhost:8080',
      '/profile': 'http://localhost:8080',
      '/socket.io': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  }
});
