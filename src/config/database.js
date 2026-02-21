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

// Initialize
prisma = createPrismaClient();

// Connect with retry
async function connectDatabase(retries = 5, delay = 5000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Attempt ${i}/${retries}:`, error.message);

      if (i === retries) {
        console.error('❌ All connection attempts failed');
        process.exit(1);
      }

      console.log(`⏳ Retrying in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Fresh client on retry
      try { await prisma.$disconnect(); } catch (e) {}
      prisma = createPrismaClient();
    }
  }
}

// Keep connection alive - ping every 4 minutes
// Uses a simple lightweight query
function startConnectionKeepAlive() {
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      console.log('🔄 Keep-alive: connection lost, reconnecting...');

      // Destroy old client completely
      try { await prisma.$disconnect(); } catch (e) {}

      // Create fresh client
      prisma = createPrismaClient();

      try {
        await prisma.$connect();
        console.log('✅ Keep-alive: reconnected successfully');
      } catch (reconnectError) {
        console.error('❌ Keep-alive: reconnect failed, will retry next cycle');
        // Don't crash - next keep-alive cycle will try again
      }
    }
  }, 4 * 60 * 1000); // Every 4 minutes
}

// Graceful shutdown
async function shutdown() {
  try {
    if (prisma) await prisma.$disconnect();
  } catch (e) {}
}

process.on('beforeExit', shutdown);
process.on('SIGINT', async () => { await shutdown(); process.exit(0); });
process.on('SIGTERM', async () => { await shutdown(); process.exit(0); });

module.exports = {
  get prisma() { return prisma; },
  connectDatabase,
  startConnectionKeepAlive,
};