import { PrismaClient } from '@prisma/client';

// Initialize Prisma client with logging in development
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'info', 'error'] : ['error'],
});

// PrismaClient does not support an 'error' event; remove this handler.
// Connection errors will throw exceptions on usage.

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
