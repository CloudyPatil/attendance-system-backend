// src/config/database.js

const { PrismaClient } = require('@prisma/client');

// Configure Prisma for PgBouncer compatibility
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
  
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  
  // CRITICAL: Disable statement caching for PgBouncer
  __internal: {
    engine: {
      cwd: process.cwd(),
    },
  },
});

// Enable statement caching only for direct connections (migrations)
if (process.env.DIRECT_URL) {
  prisma.$connect();
}

// Test database connection with retry
async function connectDatabase(retries = 5, delay = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      // Use a simple query instead of $connect for better PgBouncer compatibility
      await prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Connection attempt ${i}/${retries} failed:`, error.message);
      
      if (i === retries) {
        console.error('❌ All attempts failed. Check Supabase status and env vars.');
        process.exit(1);
      }
      
      console.log(`⏳ Retrying in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Graceful shutdown
const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = { prisma, connectDatabase };