// src/controllers/courseController.js

const { prisma } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Create a new course
 * POST /api/courses
 * Access: OWNER only
 */
async function createCourse(req, res) {
  try {
    const { name, totalClasses } = req.body;
    const ownerId = req.user.id;

    // Get owner's school
    const school = await prisma.school.findFirst({
      where: { ownerId },
    });

    if (!school) {
      return sendError(res, 'Create a school first', 400);
    }

    // Create course
    const course = await prisma.course.create({
      data: {
        name,
        totalClasses,
        schoolId: school.id,
      },
    });

    return sendSuccess(res, { course }, 'Course created successfully', 201);
  } catch (error) {
    console.error('Create course error:', error);
    return sendError(res, 'Failed to create course');
  }
}

/**
 * Get all courses in school
 * GET /api/courses
 * Access: OWNER, TRAINER
 */
async function getCourses(req, res) {
  try {
    let schoolId;

    if (req.user.role === 'OWNER') {
      const school = await prisma.school.findFirst({
        where: { ownerId: req.user.id },
      });
      if (!school) {
        return sendError(res, 'No school found', 404);
      }
      schoolId = school.id;
    } else if (req.user.role === 'TRAINER') {
      const trainer = await prisma.trainer.findUnique({
        where: { userId: req.user.id },
      });
      if (!trainer) {
        return sendError(res, 'Trainer profile not found', 404);
      }
      schoolId = trainer.schoolId;
    }

    const courses = await prisma.course.findMany({
      where: { schoolId, isActive: true },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sendSuccess(res, { courses }, 'Courses retrieved');
  } catch (error) {
    console.error('Get courses error:', error);
    return sendError(res, 'Failed to get courses');
  }
}

/**
 * Get course by ID
 * GET /api/courses/:id
 * Access: OWNER, TRAINER, STUDENT
 */
async function getCourseById(req, res) {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        school: {
          select: {
            id: true,
            name: true,
          },
        },
        enrollments: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    name: true,
                    phone: true,
                  },
                },
              },
            },
            trainer: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return sendError(res, 'Course not found', 404);
    }

    return sendSuccess(res, { course }, 'Course retrieved');
  } catch (error) {
    console.error('Get course error:', error);
    return sendError(res, 'Failed to get course');
  }
}

/**
 * Update course
 * PUT /api/courses/:id
 * Access: OWNER only
 */
async function updateCourse(req, res) {
  try {
    const { id } = req.params;
    const { name, totalClasses } = req.body;
    const ownerId = req.user.id;

    // Get owner's school
    const school = await prisma.school.findFirst({
      where: { ownerId },
    });

    if (!school) {
      return sendError(res, 'No school found', 404);
    }

    // Check if course belongs to school
    const course = await prisma.course.findFirst({
      where: { id, schoolId: school.id },
    });

    if (!course) {
      return sendError(res, 'Course not found or access denied', 404);
    }

    // Update course
    const updatedCourse = await prisma.course.update({
      where: { id },
      data: { name, totalClasses },
    });

    return sendSuccess(res, { course: updatedCourse }, 'Course updated');
  } catch (error) {
    console.error('Update course error:', error);
    return sendError(res, 'Failed to update course');
  }
}

/**
 * Toggle course active status
 * PATCH /api/courses/:id/toggle-status
 * Access: OWNER only
 */
async function toggleCourseStatus(req, res) {
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

    // Get course
    const course = await prisma.course.findFirst({
      where: { id, schoolId: school.id },
    });

    if (!course) {
      return sendError(res, 'Course not found or access denied', 404);
    }

    // Toggle status
    const updatedCourse = await prisma.course.update({
      where: { id },
      data: { isActive: !course.isActive },
    });

    return sendSuccess(
      res,
      { isActive: updatedCourse.isActive },
      `Course ${updatedCourse.isActive ? 'activated' : 'deactivated'}`
    );
  } catch (error) {
    console.error('Toggle course status error:', error);
    return sendError(res, 'Failed to update course status');
  }
}


/**
 * Delete course and all related data
 * DELETE /api/courses/:id
 * Access: OWNER only
 */
async function deleteCourse(req, res) {
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

    // Get course with all related data
    const course = await prisma.course.findFirst({
      where: { id, schoolId: school.id },
      include: {
        enrollments: {
          include: {
            schedules: {
              include: { attendance: true },
            },
          },
        },
      },
    });

    if (!course) {
      return sendError(res, 'Course not found or access denied', 404);
    }

    // Delete in correct order using transaction
    await prisma.$transaction(async (tx) => {
      for (const enrollment of course.enrollments) {
        // 1. Delete attendances
        for (const schedule of enrollment.schedules) {
          if (schedule.attendance) {
            await tx.attendance.delete({
              where: { id: schedule.attendance.id },
            });
          }
        }
        // 2. Delete schedules
        await tx.schedule.deleteMany({
          where: { enrollmentId: enrollment.id },
        });
      }

      // 3. Delete all enrollments for this course
      await tx.enrollment.deleteMany({
        where: { courseId: id },
      });

      // 4. Delete course
      await tx.course.delete({ where: { id } });
    });

    return sendSuccess(res, null, 'Course and all related data deleted');
  } catch (error) {
    console.error('Delete course error:', error);
    return sendError(res, 'Failed to delete course');
  }
}


module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  toggleCourseStatus,
  deleteCourse,
};