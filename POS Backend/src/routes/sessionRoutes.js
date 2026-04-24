'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE } = require('../models');
const v = require('./validators').session;
const c = require('../controllers/sessionController');

router.use(authenticate);

router.get('/', asyncHandler(c.listActiveSessions));
router.get('/:id', validate(v.id), asyncHandler(c.getSession));

router.post(
  '/',
  authorize(USER_ROLE.ADMIN, USER_ROLE.CASHIER, USER_ROLE.WAITER),
  validate(v.open),
  asyncHandler(c.openSession),
);

// Atomic: open session + first KOT (the "Send to Kitchen" commit point
// for a newly-tapped table). This is what the tablet UI calls.
router.post(
  '/commit',
  authorize(USER_ROLE.ADMIN, USER_ROLE.CASHIER, USER_ROLE.WAITER),
  validate(v.commit),
  asyncHandler(c.openAndDispatch),
);

// Admin-only utility: fix any tables stuck as occupied without an active
// session (from pre-fix DB state or a crashed close).
router.post(
  '/reconcile',
  authorize(USER_ROLE.ADMIN),
  asyncHandler(c.reconcileTables),
);

router.post(
  '/:id/reopen',
  authorize(USER_ROLE.ADMIN, USER_ROLE.CASHIER),
  validate(v.id),
  asyncHandler(c.reopenSession),
);

router.post(
  '/:id/close',
  authorize(USER_ROLE.ADMIN, USER_ROLE.CASHIER),
  validate(v.id),
  asyncHandler(c.closeSession),
);

module.exports = router;
