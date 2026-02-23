// src/middleware/dbRetry.js

const { reconnect, isConnectionError } = require('../config/database');

let lastHealthyTime = 0;

// Runs BEFORE every /api request
// Checks if DB is alive, reconnects if needed
async function ensureDbConnection(req, res, next) {
  const { prisma } = require('../config/database');
  const now = Date.now();

  // If DB was healthy less than 30 seconds ago, skip check
  if (now - lastHealthyTime < 30000) {
    return next();
  }

  // Check if DB is alive
  try {
    await prisma.$queryRaw`SELECT 1`;
    lastHealthyTime = Date.now();
    next();
  } catch (error) {
    console.log(`🔄 DB health check failed before ${req.method} ${req.path}. Reconnecting...`);

    try {
      await reconnect();
      lastHealthyTime = Date.now();
      console.log('✅ DB reconnected successfully');
      next();
    } catch (reconnectError) {
      console.error('❌ DB reconnection failed:', reconnectError.message);
      res.status(503).json({
        success: false,
        message: 'Database temporarily unavailable. Please try again in a few seconds.',
        retryAfter: 5,
      });
    }
  }
}

// Marks DB as unhealthy (forces recheck on next request)
function markDbUnhealthy() {
  lastHealthyTime = 0;
}

module.exports = { ensureDbConnection, markDbUnhealthy };