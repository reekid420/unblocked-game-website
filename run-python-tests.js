/**
 * Script to run Python proxy tests
 * This script checks if the Python proxy is running and then executes the tests
 */

const { spawn, exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Configuration
const PYTHON_PROXY_PORT = 6078;
const PYTHON_PROXY_URL = `http://localhost:${PYTHON_PROXY_PORT}`;
const PYTHON_PROXY_DIR = path.join(__dirname, 'python-proxy');
const TEST_TIMEOUT = 30000; // 30 seconds

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Check if Python proxy is running
 * @returns {Promise<boolean>} True if running, false otherwise
 */
function isPythonProxyRunning() {
  return new Promise((resolve) => {
    http.get(PYTHON_PROXY_URL + '/health', (res) => {
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.status === 'healthy') {
              resolve(true);
              return;
            }
          } catch (e) {
            // JSON parse error
          }
          resolve(false);
        });
      } else {
        resolve(false);
      }
    }).on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Start Python proxy
 * @returns {Promise<ChildProcess>} The Python proxy process
 */
function startPythonProxy() {
  console.log(`${colors.blue}Starting Python proxy on port ${PYTHON_PROXY_PORT}...${colors.reset}`);
  
  // Check if Python is installed
  return new Promise((resolve, reject) => {
    exec('python --version', (error) => {
      if (error) {
        // Try python3
        exec('python3 --version', (error3) => {
          if (error3) {
            reject(new Error('Python is not installed or not in PATH'));
            return;
          }
          
          // Use python3
          const pythonProcess = spawn('python3', [
            path.join(PYTHON_PROXY_DIR, 'main.py')
          ], {
            cwd: PYTHON_PROXY_DIR,
            env: {
              ...process.env,
              PORT: PYTHON_PROXY_PORT.toString()
            }
          });
          
          setupPythonProcess(pythonProcess, resolve, reject);
        });
      } else {
        // Use python
        const pythonProcess = spawn('python', [
          path.join(PYTHON_PROXY_DIR, 'main.py')
        ], {
          cwd: PYTHON_PROXY_DIR,
          env: {
            ...process.env,
            PORT: PYTHON_PROXY_PORT.toString()
          }
        });
        
        setupPythonProcess(pythonProcess, resolve, reject);
      }
    });
  });
}

/**
 * Setup Python process event handlers
 * @param {ChildProcess} pythonProcess The Python process
 * @param {Function} resolve Resolve function
 * @param {Function} reject Reject function
 */
function setupPythonProcess(pythonProcess, resolve, reject) {
  let started = false;
  
  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`${colors.cyan}[Python Proxy] ${output.trim()}${colors.reset}`);
    
    // Check if server has started
    if (output.includes('Uvicorn running on') && !started) {
      started = true;
      
      // Wait a bit for the server to fully initialize
      setTimeout(() => {
        resolve(pythonProcess);
      }, 1000);
    }
  });
  
  pythonProcess.stderr.on('data', (data) => {
    console.error(`${colors.red}[Python Proxy Error] ${data.toString().trim()}${colors.reset}`);
  });
  
  pythonProcess.on('error', (error) => {
    console.error(`${colors.red}Failed to start Python proxy: ${error.message}${colors.reset}`);
    reject(error);
  });
  
  pythonProcess.on('close', (code) => {
    if (!started) {
      reject(new Error(`Python proxy exited with code ${code} before starting`));
    } else {
      console.log(`${colors.yellow}Python proxy exited with code ${code}${colors.reset}`);
    }
  });
  
  // Set a timeout in case the server doesn't start
  setTimeout(() => {
    if (!started) {
      pythonProcess.kill();
      reject(new Error('Timeout waiting for Python proxy to start'));
    }
  }, TEST_TIMEOUT);
}

/**
 * Run Jest tests
 * @param {string} testPattern Test pattern to run
 * @returns {Promise<number>} Exit code
 */
function runTests(testPattern) {
  return new Promise((resolve) => {
    console.log(`${colors.green}Running tests: ${testPattern}${colors.reset}`);
    
    const jestProcess = spawn('npx', ['jest', testPattern, '--colors'], {
      stdio: 'inherit',
      shell: true
    });
    
    jestProcess.on('close', (code) => {
      resolve(code);
    });
  });
}

/**
 * Install dependencies if needed
 * @returns {Promise<void>}
 */
async function installDependencies() {
  // Check if node_modules exists
  if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
    console.log(`${colors.yellow}Installing Node.js dependencies...${colors.reset}`);
    
    await new Promise((resolve, reject) => {
      const npmProcess = spawn('npm', ['install'], {
        stdio: 'inherit',
        shell: true
      });
      
      npmProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }
  
  // Check if Python dependencies are installed
  const requirementsPath = path.join(PYTHON_PROXY_DIR, 'requirements.txt');
  
  if (fs.existsSync(requirementsPath)) {
    console.log(`${colors.yellow}Checking Python dependencies...${colors.reset}`);
    
    await new Promise((resolve, reject) => {
      // Try pip first
      exec('pip --version', (error) => {
        if (error) {
          // Try pip3
          exec('pip3 --version', (error3) => {
            if (error3) {
              console.log(`${colors.red}pip/pip3 not found, skipping Python dependency check${colors.reset}`);
              resolve();
              return;
            }
            
            // Use pip3
            const pipProcess = spawn('pip3', ['install', '-r', requirementsPath], {
              stdio: 'inherit',
              shell: true
            });
            
            pipProcess.on('close', (code) => {
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`pip3 install failed with code ${code}`));
              }
            });
          });
        } else {
          // Use pip
          const pipProcess = spawn('pip', ['install', '-r', requirementsPath], {
            stdio: 'inherit',
            shell: true
          });
          
          pipProcess.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`pip install failed with code ${code}`));
            }
          });
        }
      });
    });
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Install dependencies if needed
    await installDependencies();
    
    // Check if Python proxy is already running
    const isRunning = await isPythonProxyRunning();
    
    let pythonProcess = null;
    
    if (!isRunning) {
      // Start Python proxy
      pythonProcess = await startPythonProxy();
      
      // Wait for the server to be ready
      let serverReady = false;
      for (let i = 0; i < 10; i++) {
        if (await isPythonProxyRunning()) {
          serverReady = true;
          break;
        }
        
        console.log(`${colors.yellow}Waiting for Python proxy to be ready... (${i + 1}/10)${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (!serverReady) {
        throw new Error('Python proxy failed to start');
      }
    } else {
      console.log(`${colors.green}Python proxy is already running on port ${PYTHON_PROXY_PORT}${colors.reset}`);
    }
    
    // Run tests
    const testPattern = process.argv[2] || '--testMatch=\'**/__tests__/python/**/*.test.js\'';
    const exitCode = await runTests(testPattern);
    
    // Clean up
    if (pythonProcess) {
      console.log(`${colors.blue}Stopping Python proxy...${colors.reset}`);
      pythonProcess.kill();
    }
    
    process.exit(exitCode);
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function
main();
