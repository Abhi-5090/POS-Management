'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { USER_ROLE } = require('../models');
const v = require('./validators').table;
const c = require('../controllers/tableController');

router.use(authenticate);

router.get('/', asyncHandler(c.listTables));
router.post('/', authorize(USER_ROLE.ADMIN), validate(v.create), asyncHandler(c.createTable));
router.patch('/:id', authorize(USER_ROLE.ADMIN), validate(v.update), asyncHandler(c.updateTable));
router.delete('/:id', authorize(USER_ROLE.ADMIN), asyncHandler(c.deleteTable));

module.exports = router;
