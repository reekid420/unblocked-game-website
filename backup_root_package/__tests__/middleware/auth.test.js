/**
 * Tests for authentication middleware
 */

// Mock dependencies
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn()
}));

jest.mock('../../db/prisma', () => ({
  user: {
    findUnique: jest.fn()
  }
}));

// Import dependencies
const jwt = require('jsonwebtoken');
const prisma = require('../../db/prisma');
const { authenticate } = require('../../middleware/auth');

// Define global beforeEach if not already defined
global.beforeEach = global.beforeEach || ((fn) => fn());

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Authentication Middleware', () => {
  test('should return 401 if no authorization header is provided', async () => {
    const req = {
      headers: {}
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if authorization header does not start with Bearer', async () => {
    const req = {
      headers: {
        authorization: 'NotBearer token'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token verification fails', async () => {
    const req = {
      headers: {
        authorization: 'Bearer invalidtoken'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    jwt.verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if user is not found', async () => {
    const req = {
      headers: {
        authorization: 'Bearer validtoken'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    jwt.verify.mockReturnValue({ userId: '123' });
    prisma.user.findUnique.mockResolvedValue(null);

    await authenticate(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('validtoken', process.env.JWT_SECRET);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: '123' },
      select: { id: true, username: true }
    });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next and attach user to request if token is valid', async () => {
    const req = {
      headers: {
        authorization: 'Bearer validtoken'
      }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();
    const mockUser = { id: '123', username: 'testuser' };

    jwt.verify.mockReturnValue({ userId: '123' });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    await authenticate(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('validtoken', process.env.JWT_SECRET);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: '123' },
      select: { id: true, username: true }
    });
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
