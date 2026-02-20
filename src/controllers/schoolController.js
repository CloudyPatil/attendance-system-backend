// src/controllers/schoolController.js

const { prisma } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Create a new school
 * POST /api/schools
 * Access: OWNER only
 */
async function createSchool(req, res) {
  try {
    const { name } = req.body;
    const ownerId = req.user.id;

    // Check if owner already has a school
    const existingSchool = await prisma.school.findFirst({
      where: { ownerId },
    });

    if (existingSchool) {
      return sendError(res, 'You already have a school registered', 400);
    }

    // Check if school name already exists (any owner)
    const duplicateName = await prisma.school.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive', // Case-insensitive check
        },
      },
    });

    if (duplicateName) {
      return sendError(res, 'A school with this name already exists. Please choose a different name.', 400);
    }

    // Create school WITH 28-day subscription
    const now = new Date();
    const subscriptionEnd = new Date(now);
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 28);

    const school = await prisma.school.create({
      data: {
        name,
        ownerId,
        subscriptionStatus: 'ACTIVE',
        subscriptionStart: now,
        subscriptionEnd: subscriptionEnd,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    return sendSuccess(res, { school }, 'School created successfully', 201);
  } catch (error) {
    console.error('Create school error:', error);
    return sendError(res, 'Failed to create school');
  }
}
/**
 * Get owner's school
 * GET /api/schools/my-school
 * Access: OWNER only
 */
async function getMySchool(req, res) {
  try {
    const ownerId = req.user.id;

    const school = await prisma.school.findFirst({
      where: { ownerId },
      include: {
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
      return sendError(res, 'No school found', 404);
    }

    return sendSuccess(res, { school }, 'School retrieved');
  } catch (error) {
    console.error('Get my school error:', error);
    return sendError(res, 'Failed to get school');
  }
}

/**
 * Update school
 * PUT /api/schools/:id
 * Access: OWNER only (own school)
 */
async function updateSchool(req, res) {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const ownerId = req.user.id;

    // Check if school belongs to owner
    const school = await prisma.school.findFirst({
      where: { id, ownerId },
    });

    if (!school) {
      return sendError(res, 'School not found or access denied', 404);
    }

    // Update school
    const updatedSchool = await prisma.school.update({
      where: { id },
      data: { name },
    });

    return sendSuccess(res, { school: updatedSchool }, 'School updated');
  } catch (error) {
    console.error('Update school error:', error);
    return sendError(res, 'Failed to update school');
  }
}

/**
 * Get school by ID (for trainers/students to see their school)
 * GET /api/schools/:id
 * Access: Authenticated users
 */
async function getSchoolById(req, res) {
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

    return sendSuccess(res, { school }, 'School retrieved');
  } catch (error) {
    console.error('Get school error:', error);
    return sendError(res, 'Failed to get school');
  }
}

module.exports = {
  createSchool,
  getMySchool,
  updateSchool,
  getSchoolById,
};