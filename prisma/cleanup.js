// prisma/cleanup.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Starting database cleanup...\n');

  try {
    // Delete in correct FK order
    const attendances = await prisma.attendance.deleteMany({});
    console.log(`🗑️  Deleted ${attendances.count} attendances`);

    const schedules = await prisma.schedule.deleteMany({});
    console.log(`🗑️  Deleted ${schedules.count} schedules`);

    const enrollments = await prisma.enrollment.deleteMany({});
    console.log(`🗑️  Deleted ${enrollments.count} enrollments`);

    const courses = await prisma.course.deleteMany({});
    console.log(`🗑️  Deleted ${courses.count} courses`);

    const trainers = await prisma.trainer.deleteMany({});
    console.log(`🗑️  Deleted ${trainers.count} trainers`);

    const students = await prisma.student.deleteMany({});
    console.log(`🗑️  Deleted ${students.count} students`);

    const schools = await prisma.school.deleteMany({});
    console.log(`🗑️  Deleted ${schools.count} schools`);

    // Delete all non-admin users
    const users = await prisma.user.deleteMany({
      where: { role: { not: 'ADMIN' } },
    });
    console.log(`🗑️  Deleted ${users.count} non-admin users`);

    // Check admin exists
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (admin) {
      console.log(`\n✅ Super Admin preserved: ${admin.phone}`);
    } else {
      console.log(`\n⚠️  No admin found. Run: node prisma/seed.js`);
    }

    console.log(`
    ╔════════════════════════════════════════════╗
    ║        DATABASE CLEANED SUCCESSFULLY       ║
    ╠════════════════════════════════════════════╣
    ║  All owners, schools & related data gone   ║
    ║  Super Admin account preserved             ║
    ║                                            ║
    ║  Run: node prisma/seed.js (for test data)  ║
    ╚════════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();