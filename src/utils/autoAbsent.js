// src/utils/autoAbsent.js

const { prisma } = require('../config/database');

/**
 * Marks all past schedules without attendance as ABSENT
 */
async function markPastClassesAbsent() {
  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(
      now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0
    ));

    // Find all past schedules that have NO attendance record
    const missedSchedules = await prisma.schedule.findMany({
      where: {
        date: {
          lt: todayStart,
        },
        attendance: null,
      },
      select: { id: true },
    });

    if (missedSchedules.length === 0) {
      console.log('✅ No missed classes to mark absent');
      return 0;
    }

    console.log(`Found ${missedSchedules.length} missed classes, marking as absent...`);

    // Create ABSENT records one by one to avoid enum issues
    let count = 0;
    for (const schedule of missedSchedules) {
      try {
        await prisma.attendance.create({
          data: {
            scheduleId: schedule.id,
            attendanceToken: 'auto-absent-' + schedule.id,
            expiresAt: new Date(),
            // Use the same pattern your startClass uses
            status: 'ABSENT',
          },
        });
        count++;
      } catch (err) {
        // Skip if already exists (duplicate scheduleId)
        if (err.code === 'P2002') continue;
        console.log(`Skip schedule ${schedule.id}: ${err.message}`);
      }
    }

    console.log(`✅ Marked ${count} missed classes as ABSENT`);
    return count;
  } catch (error) {
    console.error('❌ Auto-absent error:', error.message);
    return 0;
  }
}

/**
 * Mark expired PENDING attendances as ABSENT
 */
async function markExpiredPendingAbsent() {
  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(
      now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0
    ));

    // Find expired pending records
    const pendingRecords = await prisma.attendance.findMany({
      where: {
        status: 'PENDING',
        schedule: {
          date: {
            lt: todayStart,
          },
        },
      },
      select: { id: true },
    });

    if (pendingRecords.length === 0) return 0;

    // Update one by one to avoid enum issues
    let count = 0;
    for (const record of pendingRecords) {
      try {
        await prisma.attendance.update({
          where: { id: record.id },
          data: { status: 'ABSENT' },
        });
        count++;
      } catch (err) {
        console.log(`Skip attendance ${record.id}: ${err.message}`);
      }
    }

    if (count > 0) {
      console.log(`✅ Marked ${count} expired pending as ABSENT`);
    }
    return count;
  } catch (error) {
    console.error('❌ Mark expired error:', error.message);
    return 0;
  }
}

/**
 * Run all auto-absent tasks
 */
async function runAutoAbsent() {
  console.log('🔄 Running auto-absent check...');
  await markPastClassesAbsent();
  await markExpiredPendingAbsent();
}

module.exports = { runAutoAbsent };