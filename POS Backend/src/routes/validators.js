'use strict';

const Joi = require('joi');
const { USER_ROLE, PAYMENT_METHOD, ORDER_ITEM_STATUS } = require('../models');

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId');

exports.auth = {
  login: {
    body: Joi.object({
      username: Joi.string().required(),
      password: Joi.string().required(),
    }),
  },
  createUser: {
    body: Joi.object({
      name: Joi.string().required(),
      username: Joi.string().alphanum().min(3).max(30).required(),
      password: Joi.string().min(6).required(),
      role: Joi.string().valid(...Object.values(USER_ROLE)).required(),
    }),
  },
  updateUser: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      name: Joi.string(),
      role: Joi.string().valid(...Object.values(USER_ROLE)),
      isActive: Joi.boolean(),
      password: Joi.string().min(6),
    }).min(1),
  },
};

exports.table = {
  create: {
    body: Joi.object({
      number: Joi.string().required(),
      displayName: Joi.string().allow(''),
      capacity: Joi.number().integer().min(1).default(4),
      section: Joi.string().default('Main'),
    }),
  },
  update: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      number: Joi.string(),
      displayName: Joi.string().allow(''),
      capacity: Joi.number().integer().min(1),
      section: Joi.string(),
      status: Joi.string().valid('free', 'occupied', 'reserved'),
      isActive: Joi.boolean(),
    }).min(1),
  },
};

const SEAT_LABEL_SCHEMA = Joi.string()
  .uppercase()
  .valid('A', 'B', 'C', 'D')
  .allow(null, '');

exports.session = {
  open: {
    body: Joi.object({
      tableId: objectId.required(),
      seatLabel: SEAT_LABEL_SCHEMA,
      guests: Joi.number().integer().min(1).default(1),
      notes: Joi.string().allow('').default(''),
    }),
  },
  commit: {
    body: Joi.object({
      tableId: objectId.required(),
      seatLabel: SEAT_LABEL_SCHEMA,
      guests: Joi.number().integer().min(1).default(1),
      notes: Joi.string().allow('').default(''),
      items: Joi.array()
        .items(
          Joi.object({
            menuItemId: objectId.required(),
            quantity: Joi.number().integer().min(1).default(1),
            notes: Joi.string().allow('').default(''),
          }),
        )
        .min(1)
        .required(),
    }),
  },
  id: { params: Joi.object({ id: objectId.required() }) },
};

exports.menu = {
  createCategory: {
    body: Joi.object({
      name: Joi.string().required(),
      slug: Joi.string(),
      kitchenStation: Joi.string().default('main'),
      displayOrder: Joi.number().integer().default(0),
      color: Joi.string(),
      icon: Joi.string().allow(''),
    }),
  },
  updateCategory: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      name: Joi.string(),
      slug: Joi.string(),
      kitchenStation: Joi.string(),
      displayOrder: Joi.number().integer(),
      color: Joi.string(),
      icon: Joi.string().allow(''),
      isActive: Joi.boolean(),
    }).min(1),
  },
  createItem: {
    body: Joi.object({
      code: Joi.string().allow(''),
      name: Joi.string().required(),
      description: Joi.string().allow(''),
      price: Joi.number().min(0).required(),
      taxRate: Joi.number().min(0).allow(null),
      category: objectId.required(),
      kitchenStation: Joi.string().allow('', null),
      type: Joi.string().valid('veg', 'non-veg', 'egg').default('veg'),
      prepTimeMinutes: Joi.number().integer().min(0).default(10),
      imageUrl: Joi.string().allow(''),
      tags: Joi.array().items(Joi.string()),
      isAvailable: Joi.boolean(),
    }),
  },
  updateItem: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      code: Joi.string().allow(''),
      name: Joi.string(),
      description: Joi.string().allow(''),
      price: Joi.number().min(0),
      taxRate: Joi.number().min(0).allow(null),
      category: objectId,
      kitchenStation: Joi.string().allow('', null),
      type: Joi.string().valid('veg', 'non-veg', 'egg'),
      prepTimeMinutes: Joi.number().integer().min(0),
      imageUrl: Joi.string().allow(''),
      tags: Joi.array().items(Joi.string()),
      isAvailable: Joi.boolean(),
      isActive: Joi.boolean(),
    }).min(1),
  },
};

exports.order = {
  id: { params: Joi.object({ id: objectId.required() }) },
  idAndItem: {
    params: Joi.object({ id: objectId.required(), itemId: objectId.required() }),
  },
  addItem: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      menuItemId: objectId.required(),
      quantity: Joi.number().integer().min(1).default(1),
      notes: Joi.string().allow('').default(''),
    }),
  },
  updateQty: {
    params: Joi.object({ id: objectId.required(), itemId: objectId.required() }),
    body: Joi.object({ quantity: Joi.number().integer().min(1).required() }),
  },
  cancelItem: {
    params: Joi.object({ id: objectId.required(), itemId: objectId.required() }),
    body: Joi.object({ reason: Joi.string().allow('').default('') }),
  },
  updateItemStatus: {
    params: Joi.object({ id: objectId.required(), itemId: objectId.required() }),
    body: Joi.object({
      status: Joi.string()
        .valid(...Object.values(ORDER_ITEM_STATUS).filter((s) => s !== 'NEW' && s !== 'CANCELLED'))
        .required(),
    }),
  },
};

exports.parcel = {
  create: {
    body: Joi.object({
      customer: Joi.object({
        name: Joi.string().allow(''),
        phone: Joi.string().allow(''),
      }).default({}),
    }),
  },
  placeAndBill: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      discount: Joi.number().min(0).default(0),
      taxRate: Joi.number().min(0),
      serviceCharge: Joi.number().min(0).default(0),
    }),
  },
};

exports.bill = {
  generate: {
    params: Joi.object({ orderId: objectId.required() }),
    body: Joi.object({
      discount: Joi.number().min(0).default(0),
      taxRate: Joi.number().min(0),
      serviceCharge: Joi.number().min(0).default(0),
    }),
  },
  settle: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      payments: Joi.array()
        .items(
          Joi.object({
            method: Joi.string().valid(...Object.values(PAYMENT_METHOD)).required(),
            amount: Joi.number().positive().required(),
            reference: Joi.string().allow(''),
          }),
        )
        .min(1)
        .required(),
    }),
  },
  cancel: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({ reason: Joi.string().allow('').default('') }),
  },
  update: {
    params: Joi.object({ id: objectId.required() }),
    body: Joi.object({
      customer: Joi.object({
        name: Joi.string().allow(''),
        phone: Joi.string().allow(''),
      }),
      tableNumber: Joi.string().allow('', null),
      items: Joi.array().items(
        Joi.object({
          menuItem: objectId.allow(null),
          name: Joi.string().required(),
          price: Joi.number().min(0).required(),
          quantity: Joi.number().integer().min(0).required(),
          lineDiscount: Joi.number().min(0).default(0),
          lineTotal: Joi.number().min(0),
        }),
      ),
      subtotal: Joi.number().min(0),
      discount: Joi.number().min(0),
      serviceCharge: Joi.number().min(0),
      taxRate: Joi.number().min(0),
      taxAmount: Joi.number().min(0),
      cgst: Joi.number().min(0),
      sgst: Joi.number().min(0),
      roundingAdjustment: Joi.number(),
      total: Joi.number().min(0),
      payments: Joi.array().items(
        Joi.object({
          method: Joi.string().valid(...Object.values(PAYMENT_METHOD)).required(),
          amount: Joi.number().min(0).required(),
          reference: Joi.string().allow(''),
          paidAt: Joi.date(),
        }),
      ),
      paidAmount: Joi.number().min(0),
      balanceDue: Joi.number().min(0),
      status: Joi.string().valid('OPEN', 'PAID', 'CANCELLED', 'REFUNDED'),
      cancelReason: Joi.string().allow(''),
      printStatus: Joi.string().valid('PENDING', 'PRINTED', 'FAILED'),
    }).min(1),
  },
  id: { params: Joi.object({ id: objectId.required() }) },
};
