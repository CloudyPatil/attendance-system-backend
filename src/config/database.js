// src/config/database.js

const { PrismaClient } = require('@prisma/client');

let prisma;

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });
}

// Initialize prisma
prisma = createPrismaClient();

// Connect with retry
async function connectDatabase(retries = 5, delay = 5000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Attempt ${i}/${retries} failed:`, error.message);

      if (i === retries) {
        console.error('❌ All connection attempts failed');
        process.exit(1);
      }

      console.log(`⏳ Retrying in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Recreate client on failure
      try { await prisma.$disconnect(); } catch (e) {}
      prisma = createPrismaClient();
    }
  }
}

// Wrapper to auto-reconnect on query failures
async function withRetry(operation, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation(prisma);
    } catch (error) {
      const isConnectionError =
        error.code === 'P1001' ||
        error.code === 'P1002' ||
        error.code === 'P1008' ||
        error.code === 'P1017' ||
        error.message?.includes('prepared statement') ||
        error.message?.includes("Can't reach database");

      if (isConnectionError && attempt < maxRetries) {
        console.log(`🔄 Reconnecting... (attempt ${attempt}/${maxRetries})`);
        try { await prisma.$disconnect(); } catch (e) {}
        prisma = createPrismaClient();
        await prisma.$connect();
        console.log('✅ Reconnected');
        continue;
      }

      throw error;
    }
  }
}

// Keep connection alive - ping every 4 minutes
function startConnectionKeepAlive() {
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      console.log('🔄 Keep-alive failed, reconnecting...');
      try { await prisma.$disconnect(); } catch (e) {}
      prisma = createPrismaClient();
      try {
        await prisma.$connect();
        console.log('✅ Reconnected via keep-alive');
      } catch (e) {
        console.error('❌ Keep-alive reconnect failed:', e.message);
      }
    }
  }, 4 * 60 * 1000); // Every 4 minutes
}

// Graceful shutdown
const shutdown = async () => {
  if (prisma) await prisma.$disconnect();
};

process.on('beforeExit', shutdown);
process.on('SIGINT', async () => { await shutdown(); process.exit(0); });
process.on('SIGTERM', async () => { await shutdown(); process.exit(0); });

module.exports = {
  get prisma() { return prisma; },
  connectDatabase,
  withRetry,
  startConnectionKeepAlive,
};