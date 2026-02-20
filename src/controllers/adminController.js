// src/controllers/adminController.js

const { prisma } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get admin dashboard stats
 * GET /api/admin/dashboard
 */
async function getDashboardStats(req, res) {
  try {
    const [
      totalSchools,
      activeSchools,
      expiredSchools,
      suspendedSchools,
      totalOwners,
      totalTrainers,
      totalStudents,
    ] = await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { subscriptionStatus: 'ACTIVE' } }),
      prisma.school.count({ where: { subscriptionStatus: 'EXPIRED' } }),
      prisma.school.count({ where: { subscriptionStatus: 'SUSPENDED' } }),
      prisma.user.count({ where: { role: 'OWNER' } }),
      prisma.trainer.count(),
      prisma.student.count(),
    ]);

    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

    const expiringSoon = await prisma.school.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        subscriptionEnd: {
          lte: fiveDaysFromNow,
          gte: new Date(),
        },
      },
      include: {
        owner: {
          select: { name: true, phone: true },
        },
      },
    });

    return sendSuccess(res, {
      stats: {
        totalSchools,
        activeSchools,
        expiredSchools,
        suspendedSchools,
        totalOwners,
        totalTrainers,
        totalStudents,
      },
      expiringSoon,
    }, 'Dashboard stats retrieved');
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return sendError(res, 'Failed to get dashboard stats');
  }
}

/**
 * Get all schools with owner details and subscription info
 * GET /api/admin/schools
 */
async function getAllSchools(req, res) {
  try {
    const schools = await prisma.school.findMany({
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            phone: true,
            isActive: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            trainers: true,
            students: true,
            courses: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const schoolsWithStats = schools.map((school) => {
      const now = new Date();
      const start = new Date(school.subscriptionStart);
      const end = school.subscriptionEnd ? new Date(school.subscriptionEnd) : null;

      const daysUsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      const daysRemaining = end ? Math.max(0, Math.floor((end - now) / (1000 * 60 * 60 * 24))) : null;
      const isExpired = end ? now > end : false;

      return {
        ...school,
        subscription: {
          status: school.subscriptionStatus,
          startDate: school.subscriptionStart,
          endDate: school.subscriptionEnd,
          daysUsed,
          daysRemaining,
          isExpired,
          note: school.subscriptionNote,
        },
      };
    });

    return sendSuccess(res, { schools: schoolsWithStats }, 'Schools retrieved');
  } catch (error) {
    console.error('Get all schools error:', error);
    return sendError(res, 'Failed to get schools');
  }
}

/**
 * Get single school details
 * GET /api/admin/schools/:id
 */
async function getSchoolDetails(req, res) {
  try {
    const { id } = req.params;

    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            phone: true,
            isActive: true,
            createdAt: true,
          },
        },
        trainers: {
          include: {
            user: {
              select: { name: true, phone: true, isActive: true },
            },
          },
        },
        students: {
          include: {
            user: {
              select: { name: true, phone: true, isActive: true },
            },
          },
        },
        courses: {
          select: {
            id: true,
            name: true,
            totalClasses: true,
            isActive: true,
            _count: { select: { enrollments: true } },
          },
        },
        _count: {
          select: {
            trainers: true,
            students: true,
            courses: true,
          },
        },
      },
    });

    if (!school) {
      return sendError(res, 'School not found', 404);
    }

    const now = new Date();
    const start = new Date(school.subscriptionStart);
    const end = school.subscriptionEnd ? new Date(school.subscriptionEnd) : null;
    const daysUsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    const daysRemaining = end ? Math.max(0, Math.floor((end - now) / (1000 * 60 * 60 * 24))) : null;

    return sendSuccess(res, {
      school,
      subscription: {
        status: school.subscriptionStatus,
        startDate: school.subscriptionStart,
        endDate: school.subscriptionEnd,
        daysUsed,
        daysRemaining,
        isExpired: end ? now > end : false,
      },
    }, 'School details retrieved');
  } catch (error) {
    console.error('Get school details error:', error);
    return sendError(res, 'Failed to get school details');
  }
}

/**
 * Activate subscription
 * POST /api/admin/schools/:id/activate
 */
async function activateSubscription(req, res) {
  try {
    const { id } = req.params;
    const { days } = req.body;

    const subscriptionDays = days || 28;
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + subscriptionDays);

    const school = await prisma.school.update({
      where: { id },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionStart: now,
        subscriptionEnd: endDate,
        subscriptionNote: null,
        isActive: true,
      },
      include: {
        owner: {
          select: { name: true, phone: true },
        },
      },
    });

    await prisma.user.update({
      where: { id: school.ownerId },
      data: { isActive: true },
    });

    return sendSuccess(res, {
      school: {
        id: school.id,
        name: school.name,
        owner: school.owner,
        subscriptionStatus: school.subscriptionStatus,
        subscriptionStart: school.subscriptionStart,
        subscriptionEnd: school.subscriptionEnd,
      },
    }, `Subscription activated for ${subscriptionDays} days`);
  } catch (error) {
    console.error('Activate subscription error:', error);
    return sendError(res, 'Failed to activate subscription');
  }
}

/**
 * Suspend subscription
 * POST /api/admin/schools/:id/suspend
 */
async function suspendSubscription(req, res) {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const school = await prisma.school.update({
      where: { id },
      data: {
        subscriptionStatus: 'SUSPENDED',
        subscriptionNote: note || 'Subscription suspended by admin',
        isActive: false,
      },
      include: {
        owner: {
          select: { name: true, phone: true },
        },
      },
    });

    return sendSuccess(res, {
      school: {
        id: school.id,
        name: school.name,
        owner: school.owner,
        subscriptionStatus: school.subscriptionStatus,
      },
    }, 'Subscription suspended');
  } catch (error) {
    console.error('Suspend subscription error:', error);
    return sendError(res, 'Failed to suspend subscription');
  }
}

/**
 * Delete school and owner completely
 * DELETE /api/admin/schools/:id
 * 
 * Uses schoolId to find ALL related data directly
 * Deletes in strict FK-safe order
 */
async function deleteSchoolAndOwner(req, res) {
  try {
    const { id } = req.params;

    // Find the school
    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!school) {
      return sendError(res, 'School not found', 404);
    }

    const schoolName = school.name;
    const ownerName = school.owner.name;
    const ownerId = school.ownerId;

    // Use schoolId to find everything directly
    const trainers = await prisma.trainer.findMany({
      where: { schoolId: id },
      select: { id: true, userId: true },
    });
    const students = await prisma.student.findMany({
      where: { schoolId: id },
      select: { id: true, userId: true },
    });
    const courses = await prisma.course.findMany({
      where: { schoolId: id },
      select: { id: true },
    });

    const trainerIds = trainers.map((t) => t.id);
    const trainerUserIds = trainers.map((t) => t.userId);
    const studentIds = students.map((s) => s.id);
    const studentUserIds = students.map((s) => s.userId);
    const courseIds = courses.map((c) => c.id);

    // Find all enrollments linked to this school's data
    const enrollmentWhereConditions = [];
    if (studentIds.length > 0) enrollmentWhereConditions.push({ studentId: { in: studentIds } });
    if (courseIds.length > 0) enrollmentWhereConditions.push({ courseId: { in: courseIds } });
    if (trainerIds.length > 0) enrollmentWhereConditions.push({ trainerId: { in: trainerIds } });

    let enrollmentIds = [];
    let scheduleIds = [];

    if (enrollmentWhereConditions.length > 0) {
      const enrollments = await prisma.enrollment.findMany({
        where: { OR: enrollmentWhereConditions },
        select: { id: true },
      });
      enrollmentIds = enrollments.map((e) => e.id);

      if (enrollmentIds.length > 0) {
        const schedules = await prisma.schedule.findMany({
          where: { enrollmentId: { in: enrollmentIds } },
          select: { id: true },
        });
        scheduleIds = schedules.map((s) => s.id);
      }
    }

    // Delete everything in strict FK-safe order inside transaction
    await prisma.$transaction(async (tx) => {
      // 1. Attendances (depends on schedules)
      if (scheduleIds.length > 0) {
        await tx.attendance.deleteMany({
          where: { scheduleId: { in: scheduleIds } },
        });
      }

      // 2. Schedules (depends on enrollments)
      if (enrollmentIds.length > 0) {
        await tx.schedule.deleteMany({
          where: { enrollmentId: { in: enrollmentIds } },
        });
      }

      // 3. Enrollments (depends on students, courses, trainers)
      if (enrollmentIds.length > 0) {
        await tx.enrollment.deleteMany({
          where: { id: { in: enrollmentIds } },
        });
      }

      // 4. Courses (depends on school)
      await tx.course.deleteMany({
        where: { schoolId: id },
      });

      // 5. Trainers (depends on school and user)
      await tx.trainer.deleteMany({
        where: { schoolId: id },
      });

      // 6. Students (depends on school and user)
      await tx.student.deleteMany({
        where: { schoolId: id },
      });

      // 7. School itself (depends on owner user)
      await tx.school.delete({
        where: { id },
      });

      // 8. Check if owner has other schools
      const otherSchools = await tx.school.count({
        where: { ownerId },
      });

      // 9. Delete owner only if no other schools exist
      if (otherSchools === 0) {
        await tx.user.delete({
          where: { id: ownerId },
        });
        console.log(`  🗑️  Deleted owner user: ${ownerName}`);
      } else {
        console.log(`  ⚠️  Owner has ${otherSchools} other school(s), kept user`);
      }

      // 10. Delete trainer user accounts
      if (trainerUserIds.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: trainerUserIds } },
        });
      }

      // 11. Delete student user accounts
      if (studentUserIds.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: studentUserIds } },
        });
      }
    });

    console.log(`✅ Deleted: "${schoolName}" by ${ownerName}`);
    console.log(`   📊 ${trainerIds.length} trainers, ${studentIds.length} students, ${courseIds.length} courses`);

    return sendSuccess(res, {
      deleted: {
        school: schoolName,
        owner: ownerName,
        trainers: trainerIds.length,
        students: studentIds.length,
        courses: courseIds.length,
        enrollments: enrollmentIds.length,
        schedules: scheduleIds.length,
      },
    }, `School "${schoolName}" and all related data deleted permanently`);
  } catch (error) {
    console.error('Delete school error:', error);
    return sendError(res, 'Failed to delete school. ' + error.message);
  }
}

module.exports = {
  getDashboardStats,
  getAllSchools,
  getSchoolDetails,
  activateSubscription,
  suspendSubscription,
  deleteSchoolAndOwner,
};