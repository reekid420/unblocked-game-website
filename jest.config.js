/**
 * Jest configuration file
 */

module.exports = {
  // The root directory where Jest should scan for tests
  rootDir: './',
  
  // The test environment that will be used for testing
  testEnvironment: 'jsdom',
  
  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
  
  // An array of file extensions your modules use
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],
  
  // A list of paths to directories that Jest should use to search for files in
  roots: ['<rootDir>'],
  
  // Setup files that will be run before each test
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Transform files with babel-jest for ES modules support
  transform: {},
  
  // Indicates whether each individual test should be reported during the run
  verbose: true,
  
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  
  // Collect test coverage information
  collectCoverage: false,
  
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  
  // An array of regexp pattern strings used to skip coverage collection
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/dist/',
    '/coverage/',
    '/public/js/uv/',
    '/public/uv/',
    '/bare-server/'
  ],
  
  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: ['text', 'lcov', 'json-summary'],
  
  // The paths to modules that run some code to configure or set up the testing framework
  // before each test
  setupFiles: [],
  
  // A map from regular expressions to module names that allow to stub out resources
  moduleNameMapper: {
    // Handle CSS/SCSS imports (with CSS modules)
    '\\.module\\.(css|scss)$': 'identity-obj-proxy',
    
    // Handle CSS/SCSS imports (without CSS modules)
    '\\.(css|scss)$': '<rootDir>/__mocks__/styleMock.js',
    
    // Handle static assets
    '\\.(jpg|jpeg|png|gif|svg|eot|otf|webp|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
      
    // Handle ES modules
    '^@/(.*)$': '<rootDir>/$1'
  },
  
  // An array of regexp pattern strings that are matched against all test paths
  // matched tests are skipped
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  
  // We're using testMatch instead of testRegex
  // testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  
  // This option allows the use of a custom results processor
  testResultsProcessor: null,
  
  // This option allows use of a custom test runner
  testRunner: 'jest-circus/runner',
  
  // Configure test environment options
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  
  // Setting this value to "fake" allows the use of fake timers for functions such as "setTimeout"
  fakeTimers: {
    enableGlobally: true
  },
  
  // An array of regexp pattern strings that are matched against all source file paths
  // before re-running tests in watch mode
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  
  // Whether to use watchman for file crawling
  watchman: true,
  
  // Projects configuration for different test environments
  projects: [
    {
      displayName: 'browser',
      testEnvironment: 'jsdom',
      testMatch: [
        '**/__tests__/js/**/*.test.js',
        '**/__tests__/components/**/*.test.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
    },
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: [
        '**/__tests__/server/**/*.test.js',
        '**/__tests__/api/**/*.test.js',
        '**/__tests__/middleware/**/*.test.js',
        '**/__tests__/routes/**/*.test.js',
        '**/__tests__/socket/**/*.test.js',
        '**/__tests__/python/**/*.test.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
    },
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: [
        '**/server/**/*.test.js',
        '**/api/**/*.test.js',
        '**/routes/**/*.test.js',
        '**/middleware/**/*.test.js',
        '**/db/**/*.test.js'
      ]
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: [
        '**/js/**/*.test.js',
        '**/public/**/*.test.js'
      ],
      setupFiles: ['<rootDir>/jest.setup.js', 'dotenv/config']
    }
  ]
};
