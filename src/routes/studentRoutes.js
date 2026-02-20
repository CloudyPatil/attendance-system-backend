// src/routes/studentRoutes.js

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const studentController = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription');
const { validate } = require('../middleware/validate');

// Validation rules
const addStudentValidation = [
  body('phone')
    .notEmpty()
    .withMessage('Phone is required')
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone must be 10 digits'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
];

// Routes

// Student's own profile (must be before /:id)
router.get(
  '/me',
  authenticate,
  checkSubscription,
  authorize('STUDENT'),
  studentController.getMyStudentProfile
);

// Owner routes
router.post(
  '/',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  addStudentValidation,
  validate,
  studentController.addStudent
);

router.get(
  '/',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  studentController.getStudents
);

router.get(
  '/:id',
  authenticate,
  checkSubscription,
  authorize('OWNER', 'TRAINER', 'STUDENT'),
  studentController.getStudentById
);

router.patch(
  '/:id/toggle-status',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  studentController.toggleStudentStatus
);

router.delete(
  '/:id',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  studentController.deleteStudent
);

module.exports = router;