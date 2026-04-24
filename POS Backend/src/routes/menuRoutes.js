'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE } = require('../models');
const v = require('./validators').menu;
const c = require('../controllers/menuController');

router.use(authenticate);

// Categories
router.get('/categories', asyncHandler(c.listCategories));
router.post(
  '/categories',
  authorize(USER_ROLE.ADMIN),
  validate(v.createCategory),
  asyncHandler(c.createCategory),
);
router.patch(
  '/categories/:id',
  authorize(USER_ROLE.ADMIN),
  validate(v.updateCategory),
  asyncHandler(c.updateCategory),
);
router.delete(
  '/categories/:id',
  authorize(USER_ROLE.ADMIN),
  asyncHandler(c.deleteCategory),
);

// Items
router.get('/items', asyncHandler(c.listMenuItems));
router.post(
  '/items',
  authorize(USER_ROLE.ADMIN),
  validate(v.createItem),
  asyncHandler(c.createMenuItem),
);
router.patch(
  '/items/:id',
  authorize(USER_ROLE.ADMIN),
  validate(v.updateItem),
  asyncHandler(c.updateMenuItem),
);
router.post(
  '/items/:id/toggle-availability',
  authorize(USER_ROLE.ADMIN, USER_ROLE.CASHIER, USER_ROLE.KITCHEN),
  asyncHandler(c.toggleMenuItemAvailability),
);
router.delete(
  '/items/:id',
  authorize(USER_ROLE.ADMIN),
  asyncHandler(c.deleteMenuItem),
);

module.exports = router;
