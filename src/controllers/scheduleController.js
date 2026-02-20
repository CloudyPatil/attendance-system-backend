// src/controllers/scheduleController.js

const { prisma } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Create a schedule for an enrollment
 * POST /api/schedules
 * Access: OWNER, TRAINER
 */
async function createSchedule(req, res) {
  try {
    const { enrollmentId, date, startTime, endTime } = req.body;

    // Verify enrollment exists
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        course: true,
        trainer: true,
      },
    });

    if (!enrollment) {
      return sendError(res, 'Enrollment not found', 404);
    }

    // If trainer, verify they own this enrollment
    if (req.user.role === 'TRAINER') {
      const trainer = await prisma.trainer.findUnique({
        where: { userId: req.user.id },
      });

      if (!trainer || trainer.id !== enrollment.trainerId) {
        return sendError(res, 'Not authorized for this enrollment', 403);
      }
    }

    // Check for existing schedule on same date for this enrollment
    const scheduleDate = new Date(date + 'T00:00:00.000Z');
    
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        enrollmentId,
        date: scheduleDate,
      },
    });

    if (existingSchedule) {
      return sendError(res, 'Schedule already exists for this date', 400);
    }

    // Count existing schedules
    const scheduleCount = await prisma.schedule.count({
      where: { enrollmentId },
    });

    if (scheduleCount >= enrollment.course.totalClasses) {
      return sendError(res, 'Maximum classes reached for this enrollment', 400);
    }

    // Create schedule
    const schedule = await prisma.schedule.create({
      data: {
        enrollmentId,
        date: new Date(date + 'T00:00:00.000Z'),
        startTime,
        endTime,
      },
      include: {
        enrollment: {
          include: {
            student: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
            course: {
              select: { name: true },
            },
          },
        },
      },
    });

    return sendSuccess(res, { schedule }, 'Schedule created successfully', 201);
  } catch (error) {
    console.error('Create schedule error:', error);
    return sendError(res, 'Failed to create schedule');
  }
}

/**
 * Get schedules (filtered by role)
 * GET /api/schedules
 * Query params: date, enrollmentId
 */
async function getSchedules(req, res) {
  try {
    const { date, enrollmentId } = req.query;
    let whereClause = {};

    // Role-based filtering
    if (req.user.role === 'OWNER') {
      const school = await prisma.school.findFirst({
        where: { ownerId: req.user.id },
      });
      if (!school) {
        return sendError(res, 'No school found', 404);
      }
      whereClause.enrollment = {
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
      whereClause.enrollment = {
        trainerId: trainer.id,
      };
    } else if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.id },
      });
      if (!student) {
        return sendError(res, 'Student profile not found', 404);
      }
      whereClause.enrollment = {
        studentId: student.id,
      };
    }

    // Additional filters
    if (date) {
      whereClause.date = new Date(date);
    }

    if (enrollmentId) {
      whereClause.enrollmentId = enrollmentId;
    }

    const schedules = await prisma.schedule.findMany({
      where: whereClause,
      include: {
        enrollment: {
          include: {
            student: {
              include: {
                user: {
                  select: { name: true, phone: true },
                },
              },
            },
            course: {
              select: { id: true, name: true },
            },
            trainer: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
        attendance: true,
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
    });

    return sendSuccess(res, { schedules }, 'Schedules retrieved');
  } catch (error) {
    console.error('Get schedules error:', error);
    return sendError(res, 'Failed to get schedules');
  }
}

/**
 * Get today's schedules for trainer
 * GET /api/schedules/today
 * Access: TRAINER
 */
async function getTodaySchedules(req, res) {
  try {
    const trainer = await prisma.trainer.findUnique({
      where: { userId: req.user.id },
    });

    if (!trainer) {
      return sendError(res, 'Trainer profile not found', 404);
    }

    const now = new Date();
    const todayStart = new Date(Date.UTC(
      now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0
    ));
    const todayEnd = new Date(Date.UTC(
      now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59
    ));

    const schedules = await prisma.schedule.findMany({
      where: {
        enrollment: {
          trainerId: trainer.id,
        },
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        enrollment: {
          include: {
            student: {
              include: {
                user: {
                  select: { name: true, phone: true },
                },
              },
            },
            course: {
              select: { name: true },
            },
          },
        },
        attendance: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return sendSuccess(res, { schedules }, "Today's schedules retrieved");
  } catch (error) {
    console.error('Get today schedules error:', error);
    return sendError(res, 'Failed to get schedules');
  }
}


/**
 * Get schedule by ID
 * GET /api/schedules/:id
 */
async function getScheduleById(req, res) {
  try {
    const { id } = req.params;

    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        enrollment: {
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
          },
        },
        attendance: true,
      },
    });

    if (!schedule) {
      return sendError(res, 'Schedule not found', 404);
    }

    return sendSuccess(res, { schedule }, 'Schedule retrieved');
  } catch (error) {
    console.error('Get schedule error:', error);
    return sendError(res, 'Failed to get schedule');
  }
}

/**
 * Update schedule
 * PUT /api/schedules/:id
 * Access: OWNER, TRAINER
 */
async function updateSchedule(req, res) {
  try {
    const { id } = req.params;
    const { date, startTime, endTime } = req.body;

    // Get schedule
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        enrollment: true,
        attendance: true,
      },
    });

    if (!schedule) {
      return sendError(res, 'Schedule not found', 404);
    }

    // Check if attendance already marked
    if (schedule.attendance && schedule.attendance.status === 'PRESENT') {
      return sendError(res, 'Cannot update schedule with marked attendance', 400);
    }

    // If trainer, verify ownership
    if (req.user.role === 'TRAINER') {
      const trainer = await prisma.trainer.findUnique({
        where: { userId: req.user.id },
      });

      if (!trainer || trainer.id !== schedule.enrollment.trainerId) {
        return sendError(res, 'Not authorized', 403);
      }
    }

    // Update schedule
    const updatedSchedule = await prisma.schedule.update({
      where: { id },
      data: {
        date: date ? new Date(date) : undefined,
        startTime,
        endTime,
      },
    });

    return sendSuccess(res, { schedule: updatedSchedule }, 'Schedule updated');
  } catch (error) {
    console.error('Update schedule error:', error);
    return sendError(res, 'Failed to update schedule');
  }
}

/**
 * Delete schedule
 * DELETE /api/schedules/:id
 * Access: OWNER, TRAINER
 */
async function deleteSchedule(req, res) {
  try {
    const { id } = req.params;

    // Get schedule
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        enrollment: true,
        attendance: true,
      },
    });

    if (!schedule) {
      return sendError(res, 'Schedule not found', 404);
    }

    // Check if attendance already marked
    if (schedule.attendance && schedule.attendance.status === 'PRESENT') {
      return sendError(res, 'Cannot delete schedule with marked attendance', 400);
    }

    // If trainer, verify ownership
    if (req.user.role === 'TRAINER') {
      const trainer = await prisma.trainer.findUnique({
        where: { userId: req.user.id },
      });

      if (!trainer || trainer.id !== schedule.enrollment.trainerId) {
        return sendError(res, 'Not authorized', 403);
      }
    }

    // Delete attendance first if exists
    if (schedule.attendance) {
      await prisma.attendance.delete({
        where: { id: schedule.attendance.id },
      });
    }

    // Delete schedule
    await prisma.schedule.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Schedule deleted');
  } catch (error) {
    console.error('Delete schedule error:', error);
    return sendError(res, 'Failed to delete schedule');
  }
}

// Get schedules by enrollment ID
const getSchedulesByEnrollment = async (req, res) => {
  try {
    const { enrollmentId } = req.params;

    const schedules = await prisma.schedule.findMany({
      where: {
        enrollmentId: enrollmentId,
      },
      include: {
        enrollment: {
          include: {
            student: {
              include: {
                user: {
                  select: { id: true, name: true, phone: true },
                },
              },
            },
            course: {
              select: { id: true, name: true, totalClasses: true },
            },
            trainer: {
              include: {
                user: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        attendance: true,
      },
      orderBy: { date: 'asc' },
    });

    res.json({
      success: true,
      data: { schedules },
    });
  } catch (error) {
    console.error('Get schedules by enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schedules',
    });
  }
};

/**
 * Get student's scheduled classes
 * GET /api/schedules/my-classes
 * Access: STUDENT
 */
async function getMySchedules(req, res) {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
    });

    if (!student) {
      return sendError(res, 'Student profile not found', 404);
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        enrollment: {
          studentId: student.id,
        },
      },
      include: {
        enrollment: {
          include: {
            course: {
              select: { id: true, name: true, totalClasses: true },
            },
            trainer: {
              include: {
                user: {
                  select: { name: true, phone: true },
                },
              },
            },
          },
        },
        attendance: true,
      },
      orderBy: [
        { date: 'desc' },
        { startTime: 'asc' },
      ],
    });

    return sendSuccess(res, { schedules }, 'My schedules retrieved');
  } catch (error) {
    console.error('Get my schedules error:', error);
    return sendError(res, 'Failed to get schedules');
  }
}

/**
 * Get student's today classes
 * GET /api/schedules/my-today
 * Access: STUDENT
 */
async function getMyTodaySchedules(req, res) {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
    });

    if (!student) {
      return sendError(res, 'Student profile not found', 404);
    }

    const now = new Date();
    const todayStart = new Date(Date.UTC(
      now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0
    ));
    const todayEnd = new Date(Date.UTC(
      now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59
    ));

    const schedules = await prisma.schedule.findMany({
      where: {
        enrollment: {
          studentId: student.id,
        },
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        enrollment: {
          include: {
            course: {
              select: { name: true },
            },
            trainer: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
        attendance: true,
      },
      orderBy: { startTime: 'asc' },
    });

    return sendSuccess(res, { schedules }, "Today's classes retrieved");
  } catch (error) {
    console.error('Get my today schedules error:', error);
    return sendError(res, 'Failed to get schedules');
  }
}

module.exports = {
  createSchedule,
  getSchedules,
  getTodaySchedules,
  getScheduleById,
  getSchedulesByEnrollment,
  getMySchedules,
  getMyTodaySchedules,
  updateSchedule,
  deleteSchedule,
};