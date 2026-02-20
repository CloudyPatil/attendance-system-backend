// src/routes/adminRoutes.js

const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require ADMIN role
router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', adminController.getDashboardStats);
router.get('/schools', adminController.getAllSchools);
router.get('/schools/:id', adminController.getSchoolDetails);
router.post('/schools/:id/activate', adminController.activateSubscription);
router.post('/schools/:id/suspend', adminController.suspendSubscription);
router.delete('/schools/:id', adminController.deleteSchoolAndOwner);

module.exports = router;