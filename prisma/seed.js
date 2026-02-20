// prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create Super Admin
  const adminPassword = await bcrypt.hash('2005harsh', 10);
  const admin = await prisma.user.upsert({
    where: { phone: '7208317436' },
    update: {},
    create: {
      phone: '7208317436',
      password: adminPassword,
      name: 'Super Admin',
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Admin created:', admin.name);

  // Create Owner
  const ownerPassword = await bcrypt.hash('owner123', 10);
  const owner = await prisma.user.upsert({
    where: { phone: '8888888888' },
    update: {},
    create: {
      phone: '8888888888',
      password: ownerPassword,
      name: 'John Owner',
      role: 'OWNER',
    },
  });
  console.log('✅ Owner created:', owner.name);

  // Create School WITH subscription fields
  const now = new Date();
  const subscriptionEnd = new Date(now);
  subscriptionEnd.setDate(subscriptionEnd.getDate() + 28); // 28 days from now

  const school = await prisma.school.upsert({
    where: { id: 'seed-school-id' },
    update: {
      subscriptionStatus: 'ACTIVE',
      subscriptionStart: now,
      subscriptionEnd: subscriptionEnd,
    },
    create: {
      id: 'seed-school-id',
      name: 'Demo Dance Academy',
      ownerId: owner.id,
      subscriptionStatus: 'ACTIVE',
      subscriptionStart: now,
      subscriptionEnd: subscriptionEnd,
    },
  });
  console.log('✅ School created:', school.name, '(Subscription: 28 days)');

  // Create Trainer
  const trainerPassword = await bcrypt.hash('trainer123', 10);
  const trainerUser = await prisma.user.upsert({
    where: { phone: '7777777777' },
    update: {},
    create: {
      phone: '7777777777',
      password: trainerPassword,
      name: 'Sarah Trainer',
      role: 'TRAINER',
    },
  });

  const trainer = await prisma.trainer.upsert({
    where: { userId: trainerUser.id },
    update: {},
    create: {
      userId: trainerUser.id,
      schoolId: school.id,
    },
  });
  console.log('✅ Trainer created:', trainerUser.name);

  // Create Student
  const studentPassword = await bcrypt.hash('student123', 10);
  const studentUser = await prisma.user.upsert({
    where: { phone: '6666666666' },
    update: {},
    create: {
      phone: '6666666666',
      password: studentPassword,
      name: 'Mike Student',
      role: 'STUDENT',
    },
  });

  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      schoolId: school.id,
    },
  });
  console.log('✅ Student created:', studentUser.name);

  // Create Course
  const course = await prisma.course.upsert({
    where: { id: 'seed-course-id' },
    update: {},
    create: {
      id: 'seed-course-id',
      name: 'Salsa Beginners',
      totalClasses: 12,
      schoolId: school.id,
    },
  });
  console.log('✅ Course created:', course.name);

  // Create Enrollment
  const enrollment = await prisma.enrollment.upsert({
    where: {
      studentId_courseId: {
        studentId: student.id,
        courseId: course.id,
      },
    },
    update: {},
    create: {
      studentId: student.id,
      courseId: course.id,
      trainerId: trainer.id,
    },
  });
  console.log('✅ Enrollment created');

  // Create a schedule for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.schedule.upsert({
    where: { id: 'seed-schedule-id' },
    update: {},
    create: {
      id: 'seed-schedule-id',
      enrollmentId: enrollment.id,
      date: today,
      startTime: '10:00',
      endTime: '11:00',
    },
  });
  console.log('✅ Schedule created for today');

  console.log(`
  ╔════════════════════════════════════════════╗
  ║           SEED COMPLETED                   ║
  ╠════════════════════════════════════════════╣
  ║  Login Credentials:                        ║
  ║                                            ║
  ║  Admin:   7208317436 / 2005harsh            ║
  ║  Owner:   8888888888 / owner123            ║
  ║  Trainer: 7777777777 / trainer123          ║
  ║  Student: 6666666666 / student123          ║
  ╚════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });