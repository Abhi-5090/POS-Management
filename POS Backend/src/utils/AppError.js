'use strict';

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', details) {
    return new AppError(msg, 400, 'BAD_REQUEST', details);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new AppError(msg, 401, 'UNAUTHORIZED');
  }
  static forbidden(msg = 'Forbidden') {
    return new AppError(msg, 403, 'FORBIDDEN');
  }
  static notFound(msg = 'Not found') {
    return new AppError(msg, 404, 'NOT_FOUND');
  }
  static conflict(msg = 'Conflict', details) {
    return new AppError(msg, 409, 'CONFLICT', details);
  }
  static unprocessable(msg = 'Unprocessable', details) {
    return new AppError(msg, 422, 'UNPROCESSABLE', details);
  }
}

module.exports = AppError;
