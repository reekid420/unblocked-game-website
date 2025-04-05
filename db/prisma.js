const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client with logging in development
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Handle connection errors
prisma.$on('error', (e) => {
  console.error('Prisma Client Error:', e);
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Export the client
module.exports = prisma; 