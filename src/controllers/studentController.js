// src/controllers/studentController.js

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Add a new student to school
 * POST /api/students
 * Access: OWNER only
 */
async function addStudent(req, res) {
  try {
    const { phone, password, name } = req.body;
    const ownerId = req.user.id;

    // Get owner's school
    const school = await prisma.school.findFirst({
      where: { ownerId },
    });

    if (!school) {
      return sendError(res, 'Create a school first', 400);
    }

    // Check if phone already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      return sendError(res, 'Phone number already registered', 400);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user and student in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          phone,
          password: hashedPassword,
          name,
          role: 'STUDENT',
        },
      });

      // Create student record
      const student = await tx.student.create({
        data: {
          userId: user.id,
          schoolId: school.id,
        },
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              name: true,
              role: true,
            },
          },
          school: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return student;
    });

    return sendSuccess(res, { student: result }, 'Student added successfully', 201);
  } catch (error) {
    console.error('Add student error:', error);
    return sendError(res, 'Failed to add student');
  }
}

/**
 * Get all students in owner's school
 * GET /api/students
 * Access: OWNER only
 */
async function getStudents(req, res) {
  try {
    const ownerId = req.user.id;

    // Get owner's school
    const school = await prisma.school.findFirst({
      where: { ownerId },
    });

    if (!school) {
      return sendError(res, 'No school found', 404);
    }

    const students = await prisma.student.findMany({
      where: { schoolId: school.id },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            name: true,
            isActive: true,
            createdAt: true,
          },
        },
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

    return sendSuccess(res, { students }, 'Students retrieved');
  } catch (error) {
    console.error('Get students error:', error);
    return sendError(res, 'Failed to get students');
  }
}

/**
 * Get student by ID
 * GET /api/students/:id
 * Access: OWNER, TRAINER, STUDENT (self)
 */
async function getStudentById(req, res) {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            name: true,
            isActive: true,
            createdAt: true,
          },
        },
        school: {
          select: {
            id: true,
            name: true,
          },
        },
        enrollments: {
          include: {
            course: {
              select: {
                id: true,
                name: true,
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

    if (!student) {
      return sendError(res, 'Student not found', 404);
    }

    return sendSuccess(res, { student }, 'Student retrieved');
  } catch (error) {
    console.error('Get student error:', error);
    return sendError(res, 'Failed to get student');
  }
}

/**
 * Toggle student active status
 * PATCH /api/students/:id/toggle-status
 * Access: OWNER only
 */
async function toggleStudentStatus(req, res) {
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

    // Get student
    const student = await prisma.student.findFirst({
      where: { id, schoolId: school.id },
      include: { user: true },
    });

    if (!student) {
      return sendError(res, 'Student not found or access denied', 404);
    }

    // Toggle status
    const updatedUser = await prisma.user.update({
      where: { id: student.userId },
      data: { isActive: !student.user.isActive },
      select: {
        id: true,
        isActive: true,
      },
    });

    return sendSuccess(
      res,
      { isActive: updatedUser.isActive },
      `Student ${updatedUser.isActive ? 'activated' : 'deactivated'}`
    );
  } catch (error) {
    console.error('Toggle student status error:', error);
    return sendError(res, 'Failed to update student status');
  }
}

/**
 * Get student's own profile
 * GET /api/students/me
 * Access: STUDENT only
 */
async function getMyStudentProfile(req, res) {
  try {
    const userId = req.user.id;

    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            name: true,
            isActive: true,
            createdAt: true,
          },
        },
        school: {
          select: {
            id: true,
            name: true,
          },
        },
        enrollments: {
          include: {
            course: {
              select: {
                id: true,
                name: true,
                totalClasses: true,
              },
            },
            trainer: {
              include: {
                user: {
                  select: {
                    name: true,
                    phone: true,
                  },
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
              take: 10,
            },
          },
        },
      },
    });

    if (!student) {
      return sendError(res, 'Student profile not found', 404);
    }

    return sendSuccess(res, { student }, 'Profile retrieved');
  } catch (error) {
    console.error('Get student profile error:', error);
    return sendError(res, 'Failed to get profile');
  }
}

async function deleteStudent(req, res) {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
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

    if (!student) {
      return sendError(res, 'Student not found', 404);
    }

    // Delete in order: attendances → schedules → enrollments → student → user
    for (const enrollment of student.enrollments) {
      for (const schedule of enrollment.schedules) {
        if (schedule.attendance) {
          await prisma.attendance.delete({ where: { id: schedule.attendance.id } });
        }
      }
      await prisma.schedule.deleteMany({ where: { enrollmentId: enrollment.id } });
      await prisma.enrollment.delete({ where: { id: enrollment.id } });
    }

    const userId = student.userId;
    await prisma.student.delete({ where: { id } });
    await prisma.user.delete({ where: { id: userId } });

    return sendSuccess(res, null, 'Student and all related data deleted');
  } catch (error) {
    console.error('Delete student error:', error);
    return sendError(res, 'Failed to delete student');
  }
}

module.exports = {
  addStudent,
  getStudents,
  getStudentById,
  toggleStudentStatus,
  getMyStudentProfile,
  deleteStudent,
};