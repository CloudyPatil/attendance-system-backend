// src/routes/attendanceRoutes.js

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const attendanceController = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription');
const { validate } = require('../middleware/validate');

// Validation rules
const markAttendanceValidation = [
  body('token')
    .notEmpty()
    .withMessage('Attendance token is required'),
];

// Routes

// Trainer starts class (generates QR)
router.post(
  '/start/:scheduleId',
  authenticate,
  checkSubscription,
  authorize('TRAINER'),
  attendanceController.startClass
);

// Student marks attendance (scans QR)
router.post(
  '/mark',
  authenticate,
  checkSubscription,
  authorize('STUDENT'),
  markAttendanceValidation,
  validate,
  attendanceController.markAttendance
);

// Get attendance status for a schedule
router.get(
  '/status/:scheduleId',
  authenticate,
  checkSubscription,
  attendanceController.getAttendanceStatus
);

// Student gets their attendance history
router.get(
  '/my-history',
  authenticate,
  checkSubscription,
  authorize('STUDENT'),
  attendanceController.getMyAttendanceHistory
);

module.exports = router;