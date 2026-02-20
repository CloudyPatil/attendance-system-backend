// src/middleware/subscription.js

const { prisma } = require('../config/database');

/**
 * Middleware to check if the school's subscription is active
 * Applied to Owner, Trainer, and Student routes
 */
async function checkSubscription(req, res, next) {
  try {
    // Admin bypasses subscription check
    if (!req.user || req.user.role === 'ADMIN') {
      return next();
    }

    let school = null;

    if (req.user.role === 'OWNER') {
      school = await prisma.school.findFirst({
        where: { ownerId: req.user.id },
      });
    } else if (req.user.role === 'TRAINER') {
      const trainer = await prisma.trainer.findUnique({
        where: { userId: req.user.id },
      });
      if (trainer) {
        school = await prisma.school.findUnique({
          where: { id: trainer.schoolId },
        });
      }
    } else if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.id },
      });
      if (student) {
        school = await prisma.school.findUnique({
          where: { id: student.schoolId },
        });
      }
    }

    // No school found - let them through (might be creating one)
    if (!school) {
      return next();
    }

    // Check if subscription expired by date
    if (
      school.subscriptionStatus === 'ACTIVE' &&
      school.subscriptionEnd &&
      new Date() > new Date(school.subscriptionEnd)
    ) {
      // Auto-expire
      await prisma.school.update({
        where: { id: school.id },
        data: {
          subscriptionStatus: 'EXPIRED',
          isActive: false,
          subscriptionNote: 'Subscription expired automatically',
        },
      });
      school.subscriptionStatus = 'EXPIRED';
    }

    // Block if expired
    if (school.subscriptionStatus === 'EXPIRED') {
      return res.status(403).json({
        success: false,
        message: 'Subscription expired',
        code: 'SUBSCRIPTION_EXPIRED',
        data: {
          schoolName: school.name,
          expiredAt: school.subscriptionEnd,
          note: school.subscriptionNote || 'Your subscription has expired. Please contact admin to renew.',
        },
      });
    }

    // Block if suspended
    if (school.subscriptionStatus === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Subscription suspended',
        code: 'SUBSCRIPTION_SUSPENDED',
        data: {
          schoolName: school.name,
          note: school.subscriptionNote || 'Your subscription has been suspended. Please contact admin.',
        },
      });
    }

    next();
  } catch (error) {
    console.error('Subscription check middleware error:', error);
    next(); // Don't block on error
  }
}

module.exports = { checkSubscription };