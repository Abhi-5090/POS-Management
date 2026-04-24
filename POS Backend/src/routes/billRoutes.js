'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE } = require('../models');
const v = require('./validators').bill;
const c = require('../controllers/billController');

router.use(authenticate);

router.get('/', asyncHandler(c.list));
router.get('/:id', validate(v.id), asyncHandler(c.get));

router.post(
  '/from-order/:orderId',
  authorize([USER_ROLE.ADMIN, USER_ROLE.CASHIER]),
  validate(v.generate),
  asyncHandler(c.generate),
);
router.post(
  '/:id/settle',
  authorize([USER_ROLE.ADMIN, USER_ROLE.CASHIER]),
  validate(v.settle),
  asyncHandler(c.settle),
);
router.post(
  '/:id/cancel',
  authorize([USER_ROLE.ADMIN]),
  validate(v.cancel),
  asyncHandler(c.cancel),
);
router.post(
  '/:id/reprint',
  authorize([USER_ROLE.ADMIN, USER_ROLE.CASHIER]),
  validate(v.id),
  asyncHandler(c.reprint),
);

// Admin-only full edit — see billService.updateBill for the rules.
router.patch(
  '/:id',
  authorize([USER_ROLE.ADMIN]),
  validate(v.update),
  asyncHandler(c.update),
);

module.exports = router;
