// Authentication middleware for Node.js backend (converted from legacy middleware/auth.js)
// Minimal change: preserves logic, uses TypeScript types, and expects Express.js

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
// @ts-ignore
import prisma from '../db/prisma.ts';

type User = {
  id: string;
  username: string;
};

export type AuthenticatedRequest = Request & {
  user?: Pick<User, 'id' | 'username'>;
};

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true },
    }).then((user: any) => {
      if (!user) {
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
        return;
      }
      req.user = user;
      next();
    }).catch((error: any) => {
      console.error('Authentication error:', error);
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
    });
  } catch (error: any) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
