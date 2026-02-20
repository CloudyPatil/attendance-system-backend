// src/controllers/trainerController.js

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Add a new trainer to school
 * POST /api/trainers
 * Access: OWNER only
 */
async function addTrainer(req, res) {
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

    // Create user and trainer in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          phone,
          password: hashedPassword,
          name,
          role: 'TRAINER',
        },
      });

      // Create trainer record
      const trainer = await tx.trainer.create({
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

      return trainer;
    });

    return sendSuccess(res, { trainer: result }, 'Trainer added successfully', 201);
  } catch (error) {
    console.error('Add trainer error:', error);
    return sendError(res, 'Failed to add trainer');
  }
}

/**
 * Get all trainers in owner's school
 * GET /api/trainers
 * Access: OWNER only
 */
async function getTrainers(req, res) {
  try {
    const ownerId = req.user.id;

    // Get owner's school
    const school = await prisma.school.findFirst({
      where: { ownerId },
    });

    if (!school) {
      return sendError(res, 'No school found', 404);
    }

    const trainers = await prisma.trainer.findMany({
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

    return sendSuccess(res, { trainers }, 'Trainers retrieved');
  } catch (error) {
    console.error('Get trainers error:', error);
    return sendError(res, 'Failed to get trainers');
  }
}

/**
 * Get trainer by ID
 * GET /api/trainers/:id
 * Access: OWNER, TRAINER (self)
 */
async function getTrainerById(req, res) {
  try {
    const { id } = req.params;

    const trainer = await prisma.trainer.findUnique({
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
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!trainer) {
      return sendError(res, 'Trainer not found', 404);
    }

    return sendSuccess(res, { trainer }, 'Trainer retrieved');
  } catch (error) {
    console.error('Get trainer error:', error);
    return sendError(res, 'Failed to get trainer');
  }
}

/**
 * Toggle trainer active status
 * PATCH /api/trainers/:id/toggle-status
 * Access: OWNER only
 */
async function toggleTrainerStatus(req, res) {
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

    // Get trainer
    const trainer = await prisma.trainer.findFirst({
      where: { id, schoolId: school.id },
      include: { user: true },
    });

    if (!trainer) {
      return sendError(res, 'Trainer not found or access denied', 404);
    }

    // Toggle status
    const updatedUser = await prisma.user.update({
      where: { id: trainer.userId },
      data: { isActive: !trainer.user.isActive },
      select: {
        id: true,
        isActive: true,
      },
    });

    return sendSuccess(
      res,
      { isActive: updatedUser.isActive },
      `Trainer ${updatedUser.isActive ? 'activated' : 'deactivated'}`
    );
  } catch (error) {
    console.error('Toggle trainer status error:', error);
    return sendError(res, 'Failed to update trainer status');
  }
}

/**
 * Get trainer's own profile
 * GET /api/trainers/me
 * Access: TRAINER only
 */
async function getMyTrainerProfile(req, res) {
  try {
    const userId = req.user.id;

    const trainer = await prisma.trainer.findUnique({
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
            course: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!trainer) {
      return sendError(res, 'Trainer profile not found', 404);
    }

    return sendSuccess(res, { trainer }, 'Profile retrieved');
  } catch (error) {
    console.error('Get trainer profile error:', error);
    return sendError(res, 'Failed to get profile');
  }
}

/**
 * Delete trainer and all related data
 * DELETE /api/trainers/:id
 * Access: OWNER only
 */
async function deleteTrainer(req, res) {
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

    // Get trainer with all related data
    const trainer = await prisma.trainer.findFirst({
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

    if (!trainer) {
      return sendError(res, 'Trainer not found or access denied', 404);
    }

    // Delete in correct order using transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete all attendances for trainer's schedules
      for (const enrollment of trainer.enrollments) {
        for (const schedule of enrollment.schedules) {
          if (schedule.attendance) {
            await tx.attendance.delete({
              where: { id: schedule.attendance.id },
            });
          }
        }
        // 2. Delete all schedules for this enrollment
        await tx.schedule.deleteMany({
          where: { enrollmentId: enrollment.id },
        });
      }

      // 3. Delete all enrollments
      await tx.enrollment.deleteMany({
        where: { trainerId: id },
      });

      // 4. Delete trainer
      const userId = trainer.userId;
      await tx.trainer.delete({ where: { id } });

      // 5. Delete user
      await tx.user.delete({ where: { id: userId } });
    });

    return sendSuccess(res, null, 'Trainer and all related data deleted');
  } catch (error) {
    console.error('Delete trainer error:', error);
    return sendError(res, 'Failed to delete trainer');
  }
}

module.exports = {
  addTrainer,
  getTrainers,
  getTrainerById,
  toggleTrainerStatus,
  getMyTrainerProfile,
  deleteTrainer,
};