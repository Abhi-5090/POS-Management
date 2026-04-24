'use strict';

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

function notFound(_req, _res, next) {
  next(AppError.notFound('Route not found'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let error = err;

  if (err.name === 'ValidationError') {
    error = AppError.badRequest('Validation error', {
      issues: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    });
  } else if (err.name === 'CastError') {
    error = AppError.badRequest(`Invalid ${err.path}: ${err.value}`);
  } else if (err.code === 11000) {
    error = AppError.conflict('Duplicate value', { keyValue: err.keyValue });
  } else if (!(err instanceof AppError)) {
    error = new AppError(err.message || 'Internal server error', 500, 'INTERNAL_ERROR');
  }

  const payload = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
  };
  if (error.details) payload.error.details = error.details;
  if (process.env.NODE_ENV !== 'production' && err.stack) payload.error.stack = err.stack;

  if (error.statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, url: req.originalUrl, method: req.method });
  } else {
    logger.warn(error.message, { url: req.originalUrl, method: req.method });
  }

  res.status(error.statusCode || 500).json(payload);
}

module.exports = { notFound, errorHandler };
