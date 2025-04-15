/**
 * Script to start both the Node.js and Python proxy servers
 * This allows for easier testing of the integrated system
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const PYTHON_PROXY_DIR = path.join(__dirname, 'python-proxy');
const PYTHON_PROXY_PORT = process.env.PYTHON_PROXY_PORT || 6078;
const NODE_SERVER_PORT = process.env.PORT || 8080;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Logger
const logger = {
  info: (prefix, message) => console.log(`${colors.bright}${colors.blue}[${prefix}]${colors.reset} ${message}`),
  success: (prefix, message) => console.log(`${colors.bright}${colors.green}[${prefix}]${colors.reset} ${message}`),
  error: (prefix, message) => console.log(`${colors.bright}${colors.red}[${prefix}]${colors.reset} ${message}`),
  warn: (prefix, message) => console.log(`${colors.bright}${colors.yellow}[${prefix}]${colors.reset} ${message}`)
};

// Check if Python is installed
function checkPythonInstallation() {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', ['--version']);
    
    pythonProcess.on('error', (error) => {
      reject(new Error(`Python not found: ${error.message}`));
    });
    
    pythonProcess.stdout.on('data', (data) => {
      logger.info('Python', `Found ${data.toString().trim()}`);
      resolve(true);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      // Some systems output version to stderr
      if (data.toString().includes('Python')) {
        logger.info('Python', `Found ${data.toString().trim()}`);
        resolve(true);
      }
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        // Try with python3
        const python3Process = spawn('python3', ['--version']);
        
        python3Process.on('error', (error) => {
          reject(new Error(`Python3 not found: ${error.message}`));
        });
        
        python3Process.stdout.on('data', (data) => {
          logger.info('Python', `Found ${data.toString().trim()}`);
          resolve(true);
        });
        
        python3Process.on('close', (code) => {
          if (code !== 0) {
            reject(new Error('Neither python nor python3 commands are available'));
          }
        });
      }
    });
  });
}

// Check if required Python packages are installed
function checkPythonRequirements() {
  return new Promise((resolve, reject) => {
    const requirementsPath = path.join(PYTHON_PROXY_DIR, 'requirements.txt');
    
    if (!fs.existsSync(requirementsPath)) {
      reject(new Error(`Requirements file not found at ${requirementsPath}`));
      return;
    }
    
    logger.info('Python', 'Checking requirements...');
    
    // Use pip to check installed packages
    const pipProcess = spawn('pip', ['list']);
    let pipOutput = '';
    
    pipProcess.stdout.on('data', (data) => {
      pipOutput += data.toString();
    });
    
    pipProcess.on('error', (error) => {
      // Try with pip3 if pip fails
      const pip3Process = spawn('pip3', ['list']);
      let pip3Output = '';
      
      pip3Process.stdout.on('data', (data) => {
        pip3Output += data.toString();
      });
      
      pip3Process.on('error', (error) => {
        reject(new Error(`Neither pip nor pip3 commands are available: ${error.message}`));
      });
      
      pip3Process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Failed to check installed Python packages with pip3'));
          return;
        }
        
        checkRequirements(pip3Output, requirementsPath, resolve, reject);
      });
    });
    
    pipProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('Failed to check installed Python packages with pip'));
        return;
      }
      
      checkRequirements(pipOutput, requirementsPath, resolve, reject);
    });
  });
}

// Helper function to check requirements
function checkRequirements(pipOutput, requirementsPath, resolve, reject) {
  let requirements = fs.readFileSync(requirementsPath, 'utf8')
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      // Handle pip extras: treat httpx[http2] as httpx + h2
      if (line.startsWith('httpx[http2]')) return ['httpx', 'h2'];
      const match = line.match(/^([^=<>~]+)/);
      return match ? [match[1].trim().toLowerCase()] : [];
    })
    .flat()
    .filter(Boolean);

  const installedPackages = pipOutput.split('\n')
    .slice(2) // Skip header lines
    .map(line => {
      const parts = line.trim().split(/\s+/);
      return parts[0] ? parts[0].toLowerCase() : null;
    })
    .filter(Boolean);

  // Remove duplicates
  requirements = [...new Set(requirements)];

  const missingPackages = requirements.filter(req => !installedPackages.includes(req));

  if (missingPackages.length > 0) {
    logger.warn('Python', `Missing packages: ${missingPackages.join(', ')}`);
    reject(new Error(`Missing Python packages: ${missingPackages.join(', ')}`));
  } else {
    logger.success('Python', 'All required packages are installed');
    resolve(true);
  }
}

// Start the Python proxy server
function startPythonProxy() {
  return new Promise((resolve, reject) => {
    logger.info('Python Proxy', `Starting on port ${PYTHON_PROXY_PORT}...`);
    
    const pythonCommand = 'D:/unblocked-game-website/python-proxy/venv/Scripts/python.exe';
    const pythonProcess = spawn(pythonCommand, ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', PYTHON_PROXY_PORT], {
      cwd: PYTHON_PROXY_DIR,
      env: { ...process.env, PORT: PYTHON_PROXY_PORT }
    });
    
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`${colors.cyan}[Python Proxy]${colors.reset} ${output}`);
      
      // Check for successful startup
      if (output.includes('Uvicorn running on') || output.includes('Application startup complete')) {
        logger.success('Python Proxy', `Server running on http://localhost:${PYTHON_PROXY_PORT}`);
        resolve(pythonProcess);
      }
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      console.error(`${colors.red}[Python Proxy Error]${colors.reset} ${error}`);
      
      // Don't reject here as some frameworks output to stderr
    });
    
    pythonProcess.on('error', (error) => {
      logger.error('Python Proxy', `Failed to start: ${error.message}`);
      reject(error);
    });
    
    // Set a timeout for startup
    const timeout = setTimeout(() => {
      if (pythonProcess) {
        logger.warn('Python Proxy', 'Startup timeout reached, but process is still running');
        resolve(pythonProcess); // Resolve anyway if process is running
      } else {
        reject(new Error('Python proxy server startup timed out'));
      }
    }, 10000);
    
    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        logger.error('Python Proxy', `Process exited with code ${code}`);
        reject(new Error(`Python proxy server exited with code ${code}`));
      }
    });
  });
}

// Start the Node.js server
function startNodeServer() {
  return new Promise((resolve, reject) => {
    logger.info('Node Server', `Starting on port ${NODE_SERVER_PORT}...`);
    
    const nodeProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: NODE_SERVER_PORT }
    });
    
    nodeProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`${colors.green}[Node Server]${colors.reset} ${output}`);
      
      // Check for successful startup
      if (output.includes(`Server running at http://0.0.0.0:${NODE_SERVER_PORT}`)) {
        logger.success('Node Server', `Server running on http://localhost:${NODE_SERVER_PORT}`);
        resolve(nodeProcess);
      }
    });
    
    nodeProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      console.error(`${colors.red}[Node Server Error]${colors.reset} ${error}`);
    });
    
    nodeProcess.on('error', (error) => {
      logger.error('Node Server', `Failed to start: ${error.message}`);
      reject(error);
    });
    
    // Set a timeout for startup
    const timeout = setTimeout(() => {
      if (nodeProcess) {
        logger.warn('Node Server', 'Startup timeout reached, but process is still running');
        resolve(nodeProcess); // Resolve anyway if process is running
      } else {
        reject(new Error('Node server startup timed out'));
      }
    }, 10000);
    
    nodeProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        logger.error('Node Server', `Process exited with code ${code}`);
        reject(new Error(`Node server exited with code ${code}`));
      }
    });
  });
}

// Handle process termination
function setupProcessHandlers(processes) {
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      logger.info('Main', `Received ${signal}, shutting down servers...`);
      
      processes.forEach(proc => {
        if (proc && !proc.killed) {
          proc.kill();
        }
      });
      
      // Force exit after a timeout
      setTimeout(() => {
        logger.warn('Main', 'Forcing exit after timeout');
        process.exit(1);
      }, 5000);
    });
  });
  
  process.on('uncaughtException', (error) => {
    logger.error('Main', `Uncaught exception: ${error.message}`);
    console.error(error);
    
    processes.forEach(proc => {
      if (proc && !proc.killed) {
        proc.kill();
      }
    });
    
    process.exit(1);
  });
}

// Main function to start all servers
async function startServers() {
  const processes = [];
  
  try {
    logger.info('Main', 'Starting servers...');
    
    // Check Python installation
    await checkPythonInstallation();
    
    // Check Python requirements
    await checkPythonRequirements();
    
    // Start Python proxy server
    const pythonProcess = await startPythonProxy();
    processes.push(pythonProcess);
    
    // Wait a moment for the Python server to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start Node.js server
    const nodeProcess = await startNodeServer();
    processes.push(nodeProcess);
    
    // Set up process termination handlers
    setupProcessHandlers(processes);
    
    logger.success('Main', 'All servers started successfully');
    logger.info('Main', `Node.js server: http://localhost:${NODE_SERVER_PORT}`);
    logger.info('Main', `Python proxy: http://localhost:${PYTHON_PROXY_PORT}`);
    
  } catch (error) {
    logger.error('Main', `Error starting servers: ${error.message}`);
    console.error(error);
    
    // Kill any started processes
    processes.forEach(proc => {
      if (proc && !proc.killed) {
        proc.kill();
      }
    });
    
    process.exit(1);
  }
}

// Start the servers
startServers();
