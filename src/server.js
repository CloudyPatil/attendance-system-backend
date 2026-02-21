// src/server.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDatabase } = require('./config/database');
const { runAutoAbsent } = require('./utils/autoAbsent');
const { checkExpiredSubscriptions } = require('./utils/subscriptionChecker');
const { dbErrorHandler } = require('./middleware/dbErrorHandler'); // ADD THIS

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

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Attendance Management API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

// API routes
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

// Database error handler (BEFORE global error handler)
app.use(dbErrorHandler);

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  console.log('🔍 DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('🔍 DIRECT_URL exists:', !!process.env.DIRECT_URL);
  console.log('🔍 Using port:', 
    process.env.DATABASE_URL?.includes('6543') ? '6543 (pooler)' : '5432 (direct)'
  );

  await connectDatabase();
  await runAutoAbsent();
  await checkExpiredSubscriptions();

  setInterval(() => {
    runAutoAbsent();
    checkExpiredSubscriptions();
  }, 60 * 60 * 1000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔═══════════════════════════════════════════╗
    ║     ATTENDANCE MANAGEMENT SYSTEM API      ║
    ╠═══════════════════════════════════════════╣
    ║  🚀 Server: http://0.0.0.0:${PORT}           ║
    ║  📝 Environment: ${(process.env.NODE_ENV || 'development').padEnd(22)}║
    ║  ✅ Database: Connected (Direct)          ║
    ║  🔄 Auto-absent: Active (hourly)          ║
    ║  ⏰ Subscription check: Active (hourly)   ║
    ╚═══════════════════════════════════════════╝
    `);
  });
}

startServer().catch(console.error);