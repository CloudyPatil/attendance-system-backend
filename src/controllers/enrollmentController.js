// src/controllers/enrollmentController.js

const { prisma } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Create enrollment (assign student to course with trainer)
 * POST /api/enrollments
 * Access: OWNER only
 */
async function createEnrollment(req, res) {
  try {
    const { studentId, courseId, trainerId } = req.body;
    const ownerId = req.user.id;

    // Get owner's school
    const school = await prisma.school.findFirst({
      where: { ownerId },
    });

    if (!school) {
      return sendError(res, 'No school found', 404);
    }

    // Verify student belongs to school
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId: school.id },
    });

    if (!student) {
      return sendError(res, 'Student not found in your school', 404);
    }

    // Verify course belongs to school
    const course = await prisma.course.findFirst({
      where: { id: courseId, schoolId: school.id, isActive: true },
    });

    if (!course) {
      return sendError(res, 'Course not found or inactive', 404);
    }

    // Verify trainer belongs to school
    const trainer = await prisma.trainer.findFirst({
      where: { id: trainerId, schoolId: school.id },
      include: {
        user: {
          select: { isActive: true },
        },
      },
    });

    if (!trainer) {
      return sendError(res, 'Trainer not found in your school', 404);
    }

    if (!trainer.user.isActive) {
      return sendError(res, 'Trainer is inactive', 400);
    }

    // Check if enrollment already exists
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { studentId, courseId },
    });

    if (existingEnrollment) {
      return sendError(res, 'Student is already enrolled in this course', 400);
    }

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId,
        courseId,
        trainerId,
      },
      include: {
        student: {
          include: {
            user: {
              select: { name: true, phone: true },
            },
          },
        },
        course: {
          select: { name: true, totalClasses: true },
        },
        trainer: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    });

    return sendSuccess(res, { enrollment }, 'Enrollment created successfully', 201);
  } catch (error) {
    console.error('Create enrollment error:', error);
    return sendError(res, 'Failed to create enrollment');
  }
}

/**
 * Get all enrollments
 * GET /api/enrollments
 * Access: OWNER, TRAINER
 */
async function getEnrollments(req, res) {
  try {
    let whereClause = {};

    if (req.user.role === 'OWNER') {
      const school = await prisma.school.findFirst({
        where: { ownerId: req.user.id },
      });
      if (!school) {
        return sendError(res, 'No school found', 404);
      }
      // Get enrollments for courses in this school
      whereClause = {
        course: {
          schoolId: school.id,
        },
      };
    } else if (req.user.role === 'TRAINER') {
      const trainer = await prisma.trainer.findUnique({
        where: { userId: req.user.id },
      });
      if (!trainer) {
        return sendError(res, 'Trainer profile not found', 404);
      }
      whereClause = { trainerId: trainer.id };
    }

    const enrollments = await prisma.enrollment.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            user: {
              select: { name: true, phone: true, isActive: true },
            },
          },
        },
        course: {
          select: { id: true, name: true, totalClasses: true },
        },
        trainer: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        _count: {
          select: { schedules: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sendSuccess(res, { enrollments }, 'Enrollments retrieved');
  } catch (error) {
    console.error('Get enrollments error:', error);
    return sendError(res, 'Failed to get enrollments');
  }
}

/**
 * Get enrollment by ID
 * GET /api/enrollments/:id
 */
async function getEnrollmentById(req, res) {
  try {
    const { id } = req.params;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: {
              select: { name: true, phone: true },
            },
          },
        },
        course: {
          select: { name: true, totalClasses: true },
        },
        trainer: {
          include: {
            user: {
              select: { name: true, phone: true },
            },
          },
        },
        schedules: {
          include: {
            attendance: true,
          },
          orderBy: {
            date: 'desc',
          },
        },
      },
    });

    if (!enrollment) {
      return sendError(res, 'Enrollment not found', 404);
    }

    return sendSuccess(res, { enrollment }, 'Enrollment retrieved');
  } catch (error) {
    console.error('Get enrollment error:', error);
    return sendError(res, 'Failed to get enrollment');
  }
}

/**
 * Delete enrollment
 * DELETE /api/enrollments/:id
 * Access: OWNER only
 */
async function deleteEnrollment(req, res) {
  try {
    const { id } = req.params;
    const ownerId = req.user.id;

    // Get owner's school
    const school = await prisma.school.findFirst({
      where: { ownerId },
    });

    if (!school) {
      return sendError(res, 'No school found', 404);
    }

    // Check if enrollment belongs to school
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id,
        course: {
          schoolId: school.id,
        },
      },
      include: {
        schedules: {
          include: { attendance: true },
        },
      },
    });

    if (!enrollment) {
      return sendError(res, 'Enrollment not found or access denied', 404);
    }

    // Delete in correct order (attendance -> schedules -> enrollment)
    await prisma.$transaction(async (tx) => {
      // Delete attendances
      for (const schedule of enrollment.schedules) {
        if (schedule.attendance) {
          await tx.attendance.delete({
            where: { id: schedule.attendance.id },
          });
        }
      }

      // Delete schedules
      await tx.schedule.deleteMany({
        where: { enrollmentId: id },
      });

      // Delete enrollment
      await tx.enrollment.delete({
        where: { id },
      });
    });

    return sendSuccess(res, null, 'Enrollment deleted successfully');
  } catch (error) {
    console.error('Delete enrollment error:', error);
    return sendError(res, 'Failed to delete enrollment');
  }
}

module.exports = {
  createEnrollment,
  getEnrollments,
  getEnrollmentById,
  deleteEnrollment,
};