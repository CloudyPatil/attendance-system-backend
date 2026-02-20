// src/controllers/reportController.js

const { prisma } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get attendance report for a course
 * GET /api/reports/course/:courseId
 * Access: OWNER, TRAINER
 */
async function getCourseAttendanceReport(req, res) {
  try {
    const { courseId } = req.params;

    // Get course with all enrollments and their attendance
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          include: {
            student: {
              include: {
                user: {
                  select: { name: true, phone: true },
                },
              },
            },
            trainer: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
            schedules: {
              include: {
                attendance: true,
              },
              orderBy: {
                date: 'asc',
              },
            },
          },
        },
      },
    });

    if (!course) {
      return sendError(res, 'Course not found', 404);
    }

    // Build report
    const report = course.enrollments.map((enrollment) => {
      const totalScheduled = enrollment.schedules.length;
      const totalPresent = enrollment.schedules.filter(
        (s) => s.attendance?.status === 'PRESENT'
      ).length;
      const attendancePercentage =
        totalScheduled > 0 ? Math.round((totalPresent / totalScheduled) * 100) : 0;

      return {
        student: {
          name: enrollment.student.user.name,
          phone: enrollment.student.user.phone,
        },
        trainer: enrollment.trainer.user.name,
        totalScheduled,
        totalPresent,
        totalAbsent: totalScheduled - totalPresent,
        attendancePercentage,
        classes: enrollment.schedules.map((s) => ({
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.attendance?.status || 'NOT_STARTED',
          markedAt: s.attendance?.markedAt,
        })),
      };
    });

    return sendSuccess(
      res,
      {
        course: {
          id: course.id,
          name: course.name,
          totalClasses: course.totalClasses,
        },
        report,
        summary: {
          totalStudents: report.length,
          averageAttendance:
            report.length > 0
              ? Math.round(
                  report.reduce((acc, r) => acc + r.attendancePercentage, 0) / report.length
                )
              : 0,
        },
      },
      'Course attendance report generated'
    );
  } catch (error) {
    console.error('Get course report error:', error);
    return sendError(res, 'Failed to generate report');
  }
}

/**
 * Get attendance report for a specific student
 * GET /api/reports/student/:studentId
 * Access: OWNER, TRAINER, STUDENT (self)
 */
async function getStudentAttendanceReport(req, res) {
  try {
    const { studentId } = req.params;

    // If student, verify they're requesting their own report
    if (req.user.role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId: req.user.id },
      });

      if (!student || student.id !== studentId) {
        return sendError(res, 'Not authorized', 403);
      }
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: { name: true, phone: true },
        },
        enrollments: {
          include: {
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
            schedules: {
              include: {
                attendance: true,
              },
              orderBy: {
                date: 'desc',
              },
            },
          },
        },
      },
    });

    if (!student) {
      return sendError(res, 'Student not found', 404);
    }

    const courseReports = student.enrollments.map((enrollment) => {
      const totalScheduled = enrollment.schedules.length;
      const totalPresent = enrollment.schedules.filter(
        (s) => s.attendance?.status === 'PRESENT'
      ).length;

      return {
        course: {
          id: enrollment.course.id,
          name: enrollment.course.name,
          totalClasses: enrollment.course.totalClasses,
        },
        trainer: enrollment.trainer.user.name,
        totalScheduled,
        totalPresent,
        remainingClasses: enrollment.course.totalClasses - totalScheduled,
        attendancePercentage:
          totalScheduled > 0 ? Math.round((totalPresent / totalScheduled) * 100) : 0,
        recentClasses: enrollment.schedules.slice(0, 5).map((s) => ({
          date: s.date,
          status: s.attendance?.status || 'NOT_STARTED',
        })),
      };
    });

    return sendSuccess(
      res,
      {
        student: {
          name: student.user.name,
          phone: student.user.phone,
        },
        courses: courseReports,
        overallStats: {
          totalCourses: courseReports.length,
          totalClassesAttended: courseReports.reduce((acc, c) => acc + c.totalPresent, 0),
          averageAttendance:
            courseReports.length > 0
              ? Math.round(
                  courseReports.reduce((acc, c) => acc + c.attendancePercentage, 0) /
                    courseReports.length
                )
              : 0,
        },
      },
      'Student attendance report generated'
    );
  } catch (error) {
    console.error('Get student report error:', error);
    return sendError(res, 'Failed to generate report');
  }
}

/**
 * Get daily attendance summary
 * GET /api/reports/daily?date=YYYY-MM-DD
 * Access: OWNER, TRAINER
 */
async function getDailyAttendanceReport(req, res) {
  try {
    const { date } = req.query;
    const reportDate = date ? new Date(date) : new Date();
    reportDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(reportDate);
    nextDay.setDate(nextDay.getDate() + 1);

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
        return sendError(res, 'Trainer not found', 404);
      }
      schoolId = trainer.schoolId;
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        date: {
          gte: reportDate,
          lt: nextDay,
        },
        enrollment: {
          course: {
            schoolId,
          },
        },
      },
      include: {
        attendance: true,
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
      orderBy: {
        startTime: 'asc',
      },
    });

    const summary = {
      date: reportDate.toISOString().split('T')[0],
      totalClasses: schedules.length,
      present: schedules.filter((s) => s.attendance?.status === 'PRESENT').length,
      pending: schedules.filter(
        (s) => !s.attendance || s.attendance.status === 'PENDING'
      ).length,
    };

    const classes = schedules.map((s) => ({
      id: s.id,
      time: `${s.startTime} - ${s.endTime}`,
      student: s.enrollment.student.user.name,
      course: s.enrollment.course.name,
      trainer: s.enrollment.trainer.user.name,
      status: s.attendance?.status || 'NOT_STARTED',
      markedAt: s.attendance?.markedAt,
    }));

    return sendSuccess(
      res,
      { summary, classes },
      'Daily attendance report generated'
    );
  } catch (error) {
    console.error('Get daily report error:', error);
    return sendError(res, 'Failed to generate report');
  }
}

module.exports = {
  getCourseAttendanceReport,
  getStudentAttendanceReport,
  getDailyAttendanceReport,
};