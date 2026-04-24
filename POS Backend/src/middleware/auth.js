'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const { User } = require('../models');

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, username: user.username },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn },
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch (err) {
    throw AppError.unauthorized('Invalid or expired token');
  }
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (req.query && req.query.token) return req.query.token;
  return null;
}

async function authenticate(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw AppError.unauthorized('Authentication required');

    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw AppError.unauthorized('User not found or inactive');

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

function authorize(...roles) {
  const allowed = roles.flat();
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (allowed.length && !allowed.includes(req.user.role)) {
      return next(AppError.forbidden(`Role '${req.user.role}' is not permitted`));
    }
    next();
  };
}

module.exports = { authenticate, authorize, signToken, verifyToken };
