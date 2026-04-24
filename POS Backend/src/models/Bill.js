'use strict';

const mongoose = require('mongoose');
const { BILL_STATUS, PAYMENT_METHOD, ORDER_TYPE } = require('./constants');

const billItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    lineDiscount: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false },
);

const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    reference: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const billSchema = new mongoose.Schema(
  {
    billNumber: { type: String, required: true, unique: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    orderType: {
      type: String,
      enum: Object.values(ORDER_TYPE),
      required: true,
      index: true,
    },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'TableSession', default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
    tableNumber: { type: String, default: null },

    customer: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
    },

    items: { type: [billItemSchema], default: [] },

    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    serviceCharge: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    roundingAdjustment: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },

    payments: { type: [paymentSchema], default: [] },
    paidAmount: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },

    status: {
      type: String,
      enum: Object.values(BILL_STATUS),
      default: BILL_STATUS.OPEN,
      index: true,
    },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },

    printStatus: {
      type: String,
      enum: ['PENDING', 'PRINTED', 'FAILED'],
      default: 'PENDING',
    },
    printedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

billSchema.index({ createdAt: -1 });
billSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Bill', billSchema);
