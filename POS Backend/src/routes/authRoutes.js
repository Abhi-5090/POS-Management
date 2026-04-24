'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE } = require('../models');
const v = require('./validators').auth;
const c = require('../controllers/authController');

router.post('/login', validate(v.login), asyncHandler(c.login));
router.get('/me', authenticate, asyncHandler(c.me));

router.post(
  '/users',
  authenticate,
  authorize(USER_ROLE.ADMIN),
  validate(v.createUser),
  asyncHandler(c.createUser),
);

router.get(
  '/users',
  authenticate,
  authorize(USER_ROLE.ADMIN),
  asyncHandler(c.listUsers),
);

router.patch(
  '/users/:id',
  authenticate,
  authorize(USER_ROLE.ADMIN),
  validate(v.updateUser),
  asyncHandler(c.updateUser),
);

router.delete(
  '/users/:id',
  authenticate,
  authorize(USER_ROLE.ADMIN),
  asyncHandler(c.deactivateUser),
);

module.exports = router;
