// src/routes/scheduleRoutes.js

const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();

const scheduleController = require('../controllers/scheduleController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription');
const { validate } = require('../middleware/validate');

// Validation rules
const createScheduleValidation = [
  body('enrollmentId')
    .notEmpty()
    .withMessage('Enrollment ID is required')
    .isUUID()
    .withMessage('Invalid enrollment ID'),
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format (use YYYY-MM-DD)'),
  body('startTime')
    .notEmpty()
    .withMessage('Start time is required')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid time format (use HH:MM)'),
  body('endTime')
    .notEmpty()
    .withMessage('End time is required')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid time format (use HH:MM)'),
];

const updateScheduleValidation = [
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('startTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid time format'),
  body('endTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid time format'),
];

// Routes

// Create schedule
router.post(
  '/',
  authenticate,
  checkSubscription,
  authorize('OWNER', 'TRAINER'),
  createScheduleValidation,
  validate,
  scheduleController.createSchedule
);

// Get all schedules
router.get(
  '/',
  authenticate,
  checkSubscription,
  scheduleController.getSchedules
);

// Get today's schedules for trainer
router.get(
  '/today',
  authenticate,
  checkSubscription,
  authorize('TRAINER'),
  scheduleController.getTodaySchedules
);

// Student's own schedules
router.get(
  '/my-classes',
  authenticate,
  checkSubscription,
  authorize('STUDENT'),
  scheduleController.getMySchedules
);

// Student's today classes
router.get(
  '/my-today',
  authenticate,
  checkSubscription,
  authorize('STUDENT'),
  scheduleController.getMyTodaySchedules
);

// Get schedules by enrollment ID
router.get(
  '/enrollment/:enrollmentId',
  authenticate,
  checkSubscription,
  scheduleController.getSchedulesByEnrollment
);

// Get single schedule by ID
router.get(
  '/:id',
  authenticate,
  checkSubscription,
  scheduleController.getScheduleById
);

// Update schedule
router.put(
  '/:id',
  authenticate,
  checkSubscription,
  authorize('OWNER', 'TRAINER'),
  updateScheduleValidation,
  validate,
  scheduleController.updateSchedule
);

// Delete schedule
router.delete(
  '/:id',
  authenticate,
  checkSubscription,
  authorize('OWNER', 'TRAINER'),
  scheduleController.deleteSchedule
);

module.exports = router;