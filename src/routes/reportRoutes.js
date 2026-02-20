// src/routes/reportRoutes.js

const express = require('express');
const router = express.Router();

const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription');

// Routes
router.get(
  '/course/:courseId',
  authenticate,
  checkSubscription,
  authorize('OWNER', 'TRAINER'),
  reportController.getCourseAttendanceReport
);

router.get(
  '/student/:studentId',
  authenticate,
  checkSubscription,
  authorize('OWNER', 'TRAINER', 'STUDENT'),
  reportController.getStudentAttendanceReport
);

router.get(
  '/daily',
  authenticate,
  checkSubscription,
  authorize('OWNER', 'TRAINER'),
  reportController.getDailyAttendanceReport
);

module.exports = router;