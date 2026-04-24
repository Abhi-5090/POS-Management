'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE } = require('../models');
const v = require('./validators').order;
const c = require('../controllers/orderController');

router.use(authenticate);

const staff = [USER_ROLE.ADMIN, USER_ROLE.CASHIER, USER_ROLE.WAITER];

router.get('/', asyncHandler(c.listOpenOrders));
router.get('/:id', validate(v.id), asyncHandler(c.getOrder));
router.get('/:id/pending-kot', validate(v.id), asyncHandler(c.previewPendingKot));

router.post('/:id/items', authorize(staff), validate(v.addItem), asyncHandler(c.addItem));
router.patch(
  '/:id/items/:itemId/quantity',
  authorize(staff),
  validate(v.updateQty),
  asyncHandler(c.updateItemQuantity),
);
router.delete(
  '/:id/items/:itemId',
  authorize(staff),
  validate(v.idAndItem),
  asyncHandler(c.removeItem),
);
router.post(
  '/:id/items/:itemId/cancel',
  authorize([USER_ROLE.ADMIN, USER_ROLE.CASHIER]),
  validate(v.cancelItem),
  asyncHandler(c.cancelItem),
);

router.post(
  '/:id/items/:itemId/status',
  authorize([USER_ROLE.ADMIN, USER_ROLE.KITCHEN, USER_ROLE.WAITER]),
  validate(v.updateItemStatus),
  asyncHandler(c.updateItemStatus),
);

router.post(
  '/:id/send-to-kitchen',
  authorize(staff),
  validate(v.id),
  asyncHandler(c.sendToKitchen),
);

module.exports = router;
