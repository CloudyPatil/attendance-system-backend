// src/middleware/dbErrorHandler.js

const { PrismaClientKnownRequestError, PrismaClientUnknownRequestError } = require('@prisma/client/runtime/library');

function dbErrorHandler(error, req, res, next) {
  // Connection errors
  if (error.code === 'P1001' || error.code === 'P1002' || error.code === 'P1008') {
    console.error('🔴 Database connection error:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Database temporarily unavailable. Please try again in a few seconds.',
      retryAfter: 3,
    });
  }

  // Prepared statement errors (PgBouncer)
  if (error.message?.includes('prepared statement')) {
    console.error('🔴 Prepared statement error:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Database connection reset. Please retry your request.',
      retryAfter: 1,
    });
  }

  next(error);
}

module.exports = { dbErrorHandler };