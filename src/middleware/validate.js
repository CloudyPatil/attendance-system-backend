// src/middleware/validate.js

const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

/**
 * Middleware to handle validation errors from express-validator
 */
function validate(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return sendError(res, 'Validation failed', 400, extractedErrors);
  }

  next();
}

module.exports = { validate };