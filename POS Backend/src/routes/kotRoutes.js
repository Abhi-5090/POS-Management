'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE } = require('../models');
const c = require('../controllers/kotController');

router.use(authenticate);

router.get('/today', asyncHandler(c.listToday));
router.get('/pending', asyncHandler(c.listPending));
router.get('/order/:orderId', asyncHandler(c.listForOrder));
router.get('/:id', asyncHandler(c.getKot));
router.post(
  '/:id/reprint',
  authorize([USER_ROLE.ADMIN, USER_ROLE.CASHIER, USER_ROLE.KITCHEN]),
  asyncHandler(c.reprint),
);

// Delete a KOT — service-layer guard restricts to REPRINTs unless
// admin passes ?force=1.
router.delete(
  '/:id',
  authorize([USER_ROLE.ADMIN, USER_ROLE.CASHIER, USER_ROLE.KITCHEN]),
  asyncHandler(c.remove),
);

module.exports = router;
