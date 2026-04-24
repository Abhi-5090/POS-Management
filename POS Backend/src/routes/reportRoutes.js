'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE } = require('../models');
const c = require('../controllers/reportController');

router.use(authenticate);
router.use(authorize([USER_ROLE.ADMIN, USER_ROLE.CASHIER]));

// Pre-computed aggregations (backed by the DailyReport collection)
router.get('/dashboard', asyncHandler(c.dashboard));
router.get('/daily-sales', asyncHandler(c.dailySales));
router.get('/kitchen-activity', asyncHandler(c.kitchenActivity));

// DailyReport — the editable collection (date format: YYYY-MM-DD)
router.get('/daily', asyncHandler(c.listDailyReports));
router.get('/daily/:date', asyncHandler(c.getDailyReport));

// Admin-only mutations
router.post(
  '/daily/:date/regenerate',
  authorize([USER_ROLE.ADMIN]),
  asyncHandler(c.regenerateDailyReport),
);
router.patch(
  '/daily/:date',
  authorize([USER_ROLE.ADMIN]),
  asyncHandler(c.updateDailyReport),
);

module.exports = router;
