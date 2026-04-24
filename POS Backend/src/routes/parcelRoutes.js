'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE } = require('../models');
const orderV = require('./validators').order;
const parcelV = require('./validators').parcel;
const c = require('../controllers/parcelController');

router.use(authenticate);

const staff = [USER_ROLE.ADMIN, USER_ROLE.CASHIER];

router.post('/', authorize(staff), validate(parcelV.create), asyncHandler(c.create));
router.post('/:id/items', authorize(staff), validate(orderV.addItem), asyncHandler(c.addItem));
router.patch(
  '/:id/items/:itemId/quantity',
  authorize(staff),
  validate(orderV.updateQty),
  asyncHandler(c.updateItemQuantity),
);
router.delete(
  '/:id/items/:itemId',
  authorize(staff),
  validate(orderV.idAndItem),
  asyncHandler(c.removeItem),
);
router.post(
  '/:id/place-and-bill',
  authorize(staff),
  validate(parcelV.placeAndBill),
  asyncHandler(c.placeAndBill),
);

module.exports = router;
