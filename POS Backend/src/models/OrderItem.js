'use strict';

const mongoose = require('mongoose');
const { ORDER_ITEM_STATUS } = require('./constants');

/**
 * OrderItem is a subdocument embedded in Order.
 * It is the *atom* of the KOT workflow:
 *
 *   NEW  →  SENT_TO_KITCHEN  →  PREPARING  →  READY  →  SERVED
 *                   ↓
 *               CANCELLED
 *
 *  - `kotBatch` records which incremental KOT shipped this item to the
 *    kitchen. A freshly added item has kotBatch=null.
 *  - We keep a denormalized snapshot of `name`/`price` so that later price
 *    changes on the MenuItem don't rewrite history.
 */
const orderItemSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    kitchenStation: { type: String, default: 'main', lowercase: true },
    notes: { type: String, default: '' },
    lineDiscount: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: Object.values(ORDER_ITEM_STATUS),
      default: ORDER_ITEM_STATUS.NEW,
      index: true,
    },
    kotBatch: { type: Number, default: null },
    sentToKitchenAt: { type: Date, default: null },
    servedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledReason: { type: String, default: '' },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, _id: true },
);

orderItemSchema.virtual('lineTotal').get(function () {
  return Math.max(0, this.price * this.quantity - (this.lineDiscount || 0));
});

orderItemSchema.set('toJSON', { virtuals: true });

module.exports = orderItemSchema;
