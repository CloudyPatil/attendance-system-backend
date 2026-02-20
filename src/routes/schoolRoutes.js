// src/routes/schoolRoutes.js

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const schoolController = require('../controllers/schoolController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription');
const { validate } = require('../middleware/validate');

// Validation rules
const schoolValidation = [
  body('name')
    .notEmpty()
    .withMessage('School name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('School name must be between 2 and 100 characters'),
];

// Routes

// Create school - NO subscription check (school doesn't exist yet)
router.post(
  '/',
  authenticate,
  authorize('OWNER'),
  schoolValidation,
  validate,
  schoolController.createSchool
);

// All other routes - WITH subscription check
router.get(
  '/my-school',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  schoolController.getMySchool
);

router.put(
  '/:id',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  schoolValidation,
  validate,
  schoolController.updateSchool
);

router.get(
  '/:id',
  authenticate,
  checkSubscription,
  schoolController.getSchoolById
);

module.exports = router;