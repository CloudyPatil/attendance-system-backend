// src/controllers/attendanceController.js

const crypto = require('crypto');
const { prisma } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Generate unique attendance token
 */
function generateAttendanceToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Start class - Generate QR code data
 * POST /api/attendance/start/:scheduleId
 * Access: TRAINER only
 */
async function startClass(req, res) {
  try {
    const { scheduleId } = req.params;
    const expiryMinutes = parseInt(req.body.expiryMinutes) || 5;

    // Get trainer
    const trainer = await prisma.trainer.findUnique({
      where: { userId: req.user.id },
    });

    if (!trainer) {
      return sendError(res, 'Trainer profile not found', 404);
    }

    // Get schedule and verify ownership
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
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
        attendance: true,
      },
    });

    if (!schedule) {
      return sendError(res, 'Schedule not found', 404);
    }

    if (schedule.enrollment.trainerId !== trainer.id) {
      return sendError(res, 'Not authorized for this schedule', 403);
    }

    // Check if attendance already marked
    if (schedule.attendance && schedule.attendance.status === 'PRESENT') {
      return sendError(res, 'Attendance already marked for this class', 400);
    }

    // Generate token and expiry
    const attendanceToken = generateAttendanceToken();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    let attendance;

    if (schedule.attendance) {
      // Update existing pending attendance
      attendance = await prisma.attendance.update({
        where: { id: schedule.attendance.id },
        data: {
          attendanceToken,
          expiresAt,
          status: 'PENDING',
        },
      });
    } else {
      // Create new attendance record
      attendance = await prisma.attendance.create({
        data: {
          scheduleId,
          attendanceToken,
          expiresAt,
          status: 'PENDING',
        },
      });
    }

    // QR data to be encoded
    const qrData = {
      token: attendanceToken,
      scheduleId,
      expiresAt: expiresAt.toISOString(),
    };

    return sendSuccess(
      res,
      {
        qrData: JSON.stringify(qrData),
        attendance: {
          id: attendance.id,
          token: attendanceToken,
          expiresAt,
          status: attendance.status,
        },
        schedule: {
          id: schedule.id,
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          studentName: schedule.enrollment.student.user.name,
          courseName: schedule.enrollment.course.name,
        },
      },
      'QR code generated. Valid for ' + expiryMinutes + ' minutes',
      201
    );
  } catch (error) {
    console.error('Start class error:', error);
    return sendError(res, 'Failed to start class');
  }
}

/**
 * Mark attendance by scanning QR
 * POST /api/attendance/mark
 * Access: STUDENT only
 */
async function markAttendance(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      return sendError(res, 'Attendance token is required', 400);
    }

    // Get student
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
    });

    if (!student) {
      return sendError(res, 'Student profile not found', 404);
    }

    // Find attendance record by token
    const attendance = await prisma.attendance.findUnique({
      where: { attendanceToken: token },
      include: {
        schedule: {
          include: {
            enrollment: {
              include: {
                student: true,
                course: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!attendance) {
      return sendError(res, 'Invalid QR code', 400);
    }

    // Check if token expired
    if (new Date() > attendance.expiresAt) {
      return sendError(res, 'QR code has expired. Ask trainer for new one', 400);
    }

    // Check if already marked
    if (attendance.status === 'PRESENT') {
      return sendError(res, 'Attendance already marked', 400);
    }

    // Verify student belongs to this schedule
    if (attendance.schedule.enrollment.studentId !== student.id) {
      return sendError(res, 'This class is not assigned to you', 403);
    }

    // Mark attendance
    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        status: 'PRESENT',
        markedAt: new Date(),
      },
    });

    return sendSuccess(
      res,
      {
        attendance: {
          id: updatedAttendance.id,
          status: updatedAttendance.status,
          markedAt: updatedAttendance.markedAt,
        },
        class: {
          date: attendance.schedule.date,
          startTime: attendance.schedule.startTime,
          courseName: attendance.schedule.enrollment.course.name,
        },
      },
      'Attendance marked successfully!'
    );
  } catch (error) {
    console.error('Mark attendance error:', error);
    return sendError(res, 'Failed to mark attendance');
  }
}

/**
 * Get attendance status for a schedule
 * GET /api/attendance/status/:scheduleId
 */
async function getAttendanceStatus(req, res) {
  try {
    const { scheduleId } = req.params;

    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        attendance: true,
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
      },
    });

    if (!schedule) {
      return sendError(res, 'Schedule not found', 404);
    }

    return sendSuccess(
      res,
      {
        schedule: {
          id: schedule.id,
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
        student: {
          name: schedule.enrollment.student.user.name,
          phone: schedule.enrollment.student.user.phone,
        },
        course: schedule.enrollment.course.name,
        attendance: schedule.attendance
          ? {
              status: schedule.attendance.status,
              markedAt: schedule.attendance.markedAt,
              expiresAt: schedule.attendance.expiresAt,
              isExpired: new Date() > schedule.attendance.expiresAt,
            }
          : null,
      },
      'Attendance status retrieved'
    );
  } catch (error) {
    console.error('Get attendance status error:', error);
    return sendError(res, 'Failed to get attendance status');
  }
}

/**
 * Get attendance history for student
 * GET /api/attendance/my-history
 * Access: STUDENT only
 */
async function getMyAttendanceHistory(req, res) {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
    });

    if (!student) {
      return sendError(res, 'Student profile not found', 404);
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        schedule: {
          enrollment: {
            studentId: student.id,
          },
        },
        status: 'PRESENT',
      },
      include: {
        schedule: {
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
          },
        },
      },
      orderBy: {
        markedAt: 'desc',
      },
    });

    const history = attendances.map((a) => ({
      date: a.schedule.date,
      time: a.schedule.startTime,
      markedAt: a.markedAt,
      course: a.schedule.enrollment.course.name,
      trainer: a.schedule.enrollment.trainer.user.name,
    }));

    return sendSuccess(res, { history, totalClasses: history.length }, 'Attendance history retrieved');
  } catch (error) {
    console.error('Get attendance history error:', error);
    return sendError(res, 'Failed to get attendance history');
  }
}

module.exports = {
  startClass,
  markAttendance,
  getAttendanceStatus,
  getMyAttendanceHistory,
};