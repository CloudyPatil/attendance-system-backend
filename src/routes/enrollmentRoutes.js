// src/routes/enrollmentRoutes.js

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const enrollmentController = require('../controllers/enrollmentController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription');
const { validate } = require('../middleware/validate');

// Validation rules
const enrollmentValidation = [
  body('studentId')
    .notEmpty()
    .withMessage('Student ID is required')
    .isUUID()
    .withMessage('Invalid student ID'),
  body('courseId')
    .notEmpty()
    .withMessage('Course ID is required')
    .isUUID()
    .withMessage('Invalid course ID'),
  body('trainerId')
    .notEmpty()
    .withMessage('Trainer ID is required')
    .isUUID()
    .withMessage('Invalid trainer ID'),
];

// Routes
router.post(
  '/',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  enrollmentValidation,
  validate,
  enrollmentController.createEnrollment
);

router.get(
  '/',
  authenticate,
  checkSubscription,
  authorize('OWNER', 'TRAINER'),
  enrollmentController.getEnrollments
);

router.get(
  '/:id',
  authenticate,
  checkSubscription,
  enrollmentController.getEnrollmentById
);

router.delete(
  '/:id',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  enrollmentController.deleteEnrollment
);

module.exports = router;