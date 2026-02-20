// src/routes/courseRoutes.js

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const courseController = require('../controllers/courseController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription');
const { validate } = require('../middleware/validate');

// Validation rules
const courseValidation = [
  body('name')
    .notEmpty()
    .withMessage('Course name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Course name must be between 2 and 100 characters'),
  body('totalClasses')
    .notEmpty()
    .withMessage('Total classes is required')
    .isInt({ min: 1, max: 365 })
    .withMessage('Total classes must be between 1 and 365'),
];

// Routes
router.post(
  '/',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  courseValidation,
  validate,
  courseController.createCourse
);

router.get(
  '/',
  authenticate,
  checkSubscription,
  authorize('OWNER', 'TRAINER'),
  courseController.getCourses
);

router.get(
  '/:id',
  authenticate,
  checkSubscription,
  courseController.getCourseById
);

router.put(
  '/:id',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  courseValidation,
  validate,
  courseController.updateCourse
);

router.patch(
  '/:id/toggle-status',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  courseController.toggleCourseStatus
);

router.delete(
  '/:id',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  courseController.deleteCourse
);

module.exports = router;