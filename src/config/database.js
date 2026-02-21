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

// Get or create Prisma instance
function getPrisma() {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
}

// Connect with retry + auto-reconnect
async function connectDatabase(retries = 5, delay = 3000) {
  prisma = createPrismaClient();
  
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
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
      
      // Create fresh client on retry
      prisma = createPrismaClient();
    }
  }
}

// Auto-reconnect on connection errors
async function executeWithRetry(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isConnectionError = 
        error.code === 'P1001' || 
        error.code === 'P1002' || 
        error.code === 'P1008' || 
        error.code === 'P1017' ||
        error.message?.includes('prepared statement') ||
        error.message?.includes("Can't reach database");
      
      if (isConnectionError && attempt < maxRetries) {
        console.log(`🔄 DB connection lost. Reconnecting... (${attempt}/${maxRetries})`);
        
        try {
          await prisma.$disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        
        prisma = createPrismaClient();
        await prisma.$connect();
        console.log('✅ Reconnected to database');
        
        continue;
      }
      
      throw error;
    }
  }
}

// Graceful shutdown
const shutdown = async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
};

process.on('beforeExit', shutdown);
process.on('SIGINT', async () => { await shutdown(); process.exit(0); });
process.on('SIGTERM', async () => { await shutdown(); process.exit(0); });

module.exports = { 
  get prisma() { return getPrisma(); },
  connectDatabase, 
  executeWithRetry 
};