// src/config/database.js

const { PrismaClient } = require('@prisma/client');

let prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

// Simple connection test (called once at startup)
async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('⚠️ Initial DB connection failed (will retry on first request):', error.message);
    // DON'T exit - let ensureDbConnection handle it
  }
}

// Reconnect - creates completely fresh client
async function reconnect() {
  try {
    await prisma.$disconnect();
  } catch (e) {
    // Ignore disconnect errors
  }

  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

  await prisma.$connect();
  console.log('✅ Database reconnected');
}

// Check if error is a connection error
function isConnectionError(error) {
  return (
    error.code === 'P1001' ||
    error.code === 'P1002' ||
    error.code === 'P1008' ||
    error.code === 'P1017' ||
    error.message?.includes('prepared statement') ||
    error.message?.includes("Can't reach database") ||
    error.message?.includes('Timed out fetching') ||
    error.message?.includes('connection pool') ||
    error.message?.includes('Connection refused')
  );
}

// Graceful shutdown
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });

module.exports = {
  get prisma() { return prisma; },
  connectDatabase,
  reconnect,
  isConnectionError,
};