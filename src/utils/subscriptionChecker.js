// src/utils/subscriptionChecker.js

const { prisma } = require('../config/database');

/**
 * Auto-expire subscriptions that have passed their end date
 */
async function checkExpiredSubscriptions() {
  try {
    const now = new Date();

    const result = await prisma.school.updateMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        subscriptionEnd: {
          lt: now,
        },
      },
      data: {
        subscriptionStatus: 'EXPIRED',
        subscriptionNote: 'Subscription expired automatically',
        isActive: false,
      },
    });

    if (result.count > 0) {
      console.log(`⏰ ${result.count} subscription(s) expired automatically`);
    }

    return result.count;
  } catch (error) {
    console.error('❌ Subscription check error:', error.message);
    return 0;
  }
}

module.exports = { checkExpiredSubscriptions };