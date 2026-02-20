// src/controllers/authController.js

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Register a new user
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { phone, password, name, role } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      return sendError(res, 'Phone number already registered', 400);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        phone,
        password: hashedPassword,
        name,
        role,
      },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate token
    const token = generateToken({ userId: user.id, role: user.role });

    return sendSuccess(
      res,
      { user, token },
      'Registration successful',
      201
    );
  } catch (error) {
    console.error('Register error:', error);
    return sendError(res, 'Registration failed');
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { phone, password } = req.body;

    // Find user by phone
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return sendError(res, 'Invalid phone or password', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      return sendError(res, 'Account is deactivated', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return sendError(res, 'Invalid phone or password', 401);
    }

    // Generate token
    const token = generateToken({ userId: user.id, role: user.role });

    // Return user data (without password)
    const userData = {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
    };

    return sendSuccess(res, { user: userData, token }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 'Login failed');
  }
}

/**
 * Get current user profile
 * GET /api/auth/me
 */
async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return sendSuccess(res, { user }, 'Profile retrieved');
  } catch (error) {
    console.error('GetMe error:', error);
    return sendError(res, 'Failed to get profile');
  }
}

/**
 * Change password
 * PUT /api/auth/change-password
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return sendError(res, 'Current password is incorrect', 400);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return sendSuccess(res, null, 'Password changed successfully');
  } catch (error) {
    console.error('Change password error:', error);
    return sendError(res, 'Failed to change password');
  }
}

module.exports = {
  register,
  login,
  getMe,
  changePassword,
};