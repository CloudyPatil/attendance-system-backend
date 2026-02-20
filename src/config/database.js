// src/config/database.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

// Test database connection with retry
async function connectDatabase(retries = 5, delay = 5000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Database connection attempt ${i}/${retries} failed:`, error.message);
      
      if (i === retries) {
        console.error('❌ All connection attempts failed. Exiting...');
        console.error('💡 Check: Is Supabase project active? Are env vars set on Render?');
        process.exit(1);
      }
      
      console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = { prisma, connectDatabase };