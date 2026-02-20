// src/routes/trainerRoutes.js

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const trainerController = require('../controllers/trainerController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription');
const { validate } = require('../middleware/validate');

// Validation rules
const addTrainerValidation = [
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

// Trainer's own profile (must be before /:id to avoid conflict)
router.get(
  '/me',
  authenticate,
  checkSubscription,
  authorize('TRAINER'),
  trainerController.getMyTrainerProfile
);

// Owner routes
router.post(
  '/',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  addTrainerValidation,
  validate,
  trainerController.addTrainer
);

router.get(
  '/',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  trainerController.getTrainers
);

router.get(
  '/:id',
  authenticate,
  checkSubscription,
  authorize('OWNER', 'TRAINER'),
  trainerController.getTrainerById
);

router.patch(
  '/:id/toggle-status',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  trainerController.toggleTrainerStatus
);

router.delete(
  '/:id',
  authenticate,
  checkSubscription,
  authorize('OWNER'),
  trainerController.deleteTrainer
);

module.exports = router;