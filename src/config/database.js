// src/config/database.js

const { PrismaClient } = require('@prisma/client');

// Create a single instance of Prisma Client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Test database connection
async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Disconnect on app termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = { prisma, connectDatabase };