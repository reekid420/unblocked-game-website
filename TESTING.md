# Jest Testing Implementation

## Overview
This document outlines the Jest testing implementation for the Study Resources Center (unblocked game website) project. The testing framework has been set up to provide comprehensive coverage of both frontend and backend components.

## Test Structure

### Directory Structure
Tests are organized in the `__tests__` directory with the following structure:
```
__tests__/
├── api/              # Tests for API integrations (e.g., Gemini AI)
├── js/               # Tests for frontend JavaScript modules
├── middleware/       # Tests for Express middleware
├── python/           # Tests for Python FastAPI proxy integration
├── routes/           # Tests for Express routes
├── server/           # Tests for server functionality
└── socket/           # Tests for Socket.io functionality
```

### Test Environment
- **Browser Environment**: Uses jsdom for testing frontend code
- **Node Environment**: Uses node for testing backend code
- **Mock Environment**: Comprehensive mocking of browser APIs, fetch, localStorage, etc.

## Configuration Files

### Jest Configuration
- **jest.config.js**: Main configuration file with settings for both frontend and backend testing
- **jest.setup.js**: Setup file that runs before tests to mock browser globals and other dependencies

### Environment Variables
- **.env.test**: Contains test-specific environment variables

### Mock Files
- **__mocks__/fileMock.js**: Mock for file imports
- **__mocks__/styleMock.js**: Mock for CSS/SCSS imports

## Test Coverage

The following components have been covered with tests:

### Frontend Components
- **Utility Functions**: Input sanitization, URL validation, etc.
- **Form Validation**: Signup and login form validation
- **Authentication**: Login, logout, session management
- **Proxy Functionality**: Ultraviolet proxy initialization, URL processing
- **API Client**: AJAX requests, error handling

### Backend Components
- **Server Routes**: Express route handlers
- **Middleware**: Authentication, rate limiting, error handling
- **API Integration**: Gemini AI integration with rate limiting
- **Socket.io**: Real-time communication
- **Python Proxy**: FastAPI proxy server integration with comprehensive test coverage for:
  - Authentication (JWT, API key, service token)
  - AI chat functionality with conversation management
  - Proxy request handling with caching and metrics
  - Rate limiting and error handling

## Running Tests

### Available Scripts
- `npm test`: Run all tests
- `npm run test:watch`: Run tests in watch mode
- `npm run test:coverage`: Run tests with coverage report
- `npm run test:browser`: Run only browser environment tests
- `npm run test:node`: Run only Node.js environment tests
- `npm run test:python`: Run only Python proxy tests
- `npm run test:python:auto`: Run Python proxy tests with automatic server startup
- `npm run test:integration`: Run only integration tests
- `npm run test:all`: Run all tests with coverage report
- `npm run test:ci`: Run tests in CI environment
- `npm run test:update`: Update test snapshots

## Best Practices

### Writing Tests
1. **Isolation**: Each test should be independent and not rely on the state from other tests
2. **Mocking**: Use Jest's mocking capabilities to isolate the code being tested
3. **Coverage**: Aim for high test coverage, especially for critical components
4. **Readability**: Use descriptive test names and organize tests logically

### Test Organization
1. **Describe Blocks**: Group related tests using `describe`
2. **Setup/Teardown**: Use `beforeEach`, `afterEach`, `beforeAll`, and `afterAll` for setup and cleanup
3. **Assertions**: Use Jest's assertion methods to verify expected behavior

## Dependencies

The following testing-related dependencies are used:

- **jest**: Core testing framework
- **jest-environment-jsdom**: Browser-like environment for frontend tests
- **jest-environment-node**: Node.js environment for backend tests
- **supertest**: HTTP assertions for testing Express routes
- **@testing-library/dom**: DOM testing utilities
- **@testing-library/jest-dom**: Custom DOM element matchers
- **@testing-library/user-event**: User event simulation
- **socket.io-client**: Client for testing Socket.io
- **axios-mock-adapter**: Mocking HTTP requests

## Cross-Platform Compatibility

The testing setup is designed to work across both Windows and Linux environments, with special attention to:
- Path handling
- Environment variable loading
- Module resolution

## Python Proxy Testing

### Test Categories

1. **Authentication Tests** (`auth.test.js`)
   - JWT token authentication
   - API key authentication
   - Service token validation
   - Optional authentication for public endpoints

2. **AI Router Tests** (`ai_router.test.js`)
   - Chat message processing
   - Conversation management
   - Rate limiting
   - Error handling
   - Suggested topics generation

3. **Proxy Router Tests** (`proxy_router.test.js`)
   - Request proxying
   - Header and body forwarding
   - Caching mechanism
   - Error handling
   - Metrics collection

4. **Utility Tests** (`utils.test.js`)
   - Authentication utilities
   - Rate limiting functions
   - Caching mechanisms
   - Error handling
   - Request ID generation
   - Conversation management

5. **Integration Tests** (`integration/python_integration.test.js`)
   - Node.js to Python proxy communication
   - Error handling between systems
   - Cross-Origin Resource Sharing (CORS)

### Automated Testing

The project includes a custom test runner script (`run-python-tests.js`) that:

1. Checks if Python and required dependencies are installed
2. Automatically starts the Python proxy server if not running
3. Runs the Jest tests against the running server
4. Shuts down the server after tests complete

To use this automated testing:

```bash
npm run test:python:auto
```

### Mock Implementation

The tests use several mocking strategies:

- **Fetch Mocking**: All HTTP requests are mocked to avoid actual network calls
- **JWT Mocking**: Token generation and verification for testing authentication
- **Cache Mocking**: In-memory cache simulation for testing caching behavior
- **Rate Limiter Mocking**: Simulated rate limiting for testing throttling behavior

## Future Improvements

1. **Component Testing**: Add tests for UI components as React migration progresses
2. **Integration Tests**: Further expand integration tests between Node.js and Python components
3. **End-to-End Tests**: Implement end-to-end tests using Playwright or Cypress
4. **Performance Testing**: Add tests to measure and ensure performance metrics
5. **Visual Regression Testing**: Implement visual testing for UI components
6. **Load Testing**: Add tests to verify system behavior under high load
7. **Security Testing**: Implement specific tests for security vulnerabilities
