// src/server.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDatabase, isConnectionError } = require('./config/database');
const { ensureDbConnection, markDbUnhealthy } = require('./middleware/dbRetry');
const { runAutoAbsent } = require('./utils/autoAbsent');
const { checkExpiredSubscriptions } = require('./utils/subscriptionChecker');

// Import routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const trainerRoutes = require('./routes/trainerRoutes');
const studentRoutes = require('./routes/studentRoutes');
const courseRoutes = require('./routes/courseRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

// Health check (NO database needed)
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Attendance Management API is running',
    version: '1.0.0',
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ========================================
// DB CONNECTION CHECK - BEFORE ALL /api ROUTES
// This ONE line protects ALL routes!
// ========================================
app.use('/api', ensureDbConnection);

// API routes (NO changes needed in route files!)
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler - catches DB errors from ANY middleware/controller
app.use((error, req, res, next) => {
  if (isConnectionError(error)) {
    console.error('🔴 DB error in request:', error.message);
    markDbUnhealthy(); // Force reconnect on next request
    return res.status(503).json({
      success: false,
      message: 'Database connection lost. Please retry your request.',
      retryAfter: 3,
    });
  }

  console.error('Unhandled error:', error.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  console.log('🔍 DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('🔍 DIRECT_URL exists:', !!process.env.DIRECT_URL);

  await connectDatabase();

  // Run startup tasks (won't crash if DB fails)
  try { await runAutoAbsent(); } catch (e) { console.log('⚠️ Auto-absent skipped:', e.message); }
  try { await checkExpiredSubscriptions(); } catch (e) { console.log('⚠️ Subscription check skipped:', e.message); }

  // Run auto tasks every hour
  setInterval(async () => {
    try { await runAutoAbsent(); } catch (e) { console.log('⚠️ Auto-absent error:', e.message); }
    try { await checkExpiredSubscriptions(); } catch (e) { console.log('⚠️ Subscription check error:', e.message); }
  }, 60 * 60 * 1000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║     ATTENDANCE MANAGEMENT SYSTEM API      ║
    ╠═══════════════════════════════════════════╣
    ║  🚀 Server: http://0.0.0.0:${PORT}           ║
    ║  📝 Environment: ${(process.env.NODE_ENV || 'development').padEnd(22)}║
    ║  ✅ Database: Auto-reconnect enabled      ║
    ║  🔄 Auto-absent: Active (hourly)          ║
    ║  ⏰ Subscription check: Active (hourly)   ║
    ╚═══════════════════════════════════════════╝
    `);
  });
}

startServer().catch(console.error);