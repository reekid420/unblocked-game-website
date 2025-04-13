module.exports = {
  apps: [
    {
      name: 'node-server',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      }
    },
    {
      name: 'python-proxy',
      script: 'python3 -m uvicorn main:app --host 0.0.0.0 --port 6078',
      cwd: './python-proxy',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PORT: 6078
      }
    }
  ]
};
