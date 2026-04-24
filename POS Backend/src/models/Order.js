'use strict';

const mongoose = require('mongoose');
const orderItemSchema = require('./OrderItem');
const { ORDER_TYPE, ORDER_ITEM_STATUS } = require('./constants');

/**
 * An Order represents ONE ticket of items, either:
 *   - attached to a TableSession (DINING), or
 *   - standalone (PARCEL).
 *
 * A dining session has exactly one open Order at any time. Incremental
 * dispatches to the kitchen bump `kotSequence` and stamp items with that
 * batch number — this is what prevents duplicate KOTs.
 */
const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, required: true, index: true },
    type: {
      type: String,
      enum: Object.values(ORDER_TYPE),
      required: true,
      index: true,
    },

    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TableSession',
      default: null,
      index: true,
    },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
    tableNumber: { type: String, default: null },

    customer: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
    },

    items: { type: [orderItemSchema], default: [] },

    kotSequence: { type: Number, default: 0 },
    bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null },
    isClosed: { type: Boolean, default: false, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

orderSchema.index({ type: 1, isClosed: 1, createdAt: -1 });

orderSchema.virtual('pendingItems').get(function () {
  return this.items.filter((it) => it.status === ORDER_ITEM_STATUS.NEW);
});

orderSchema.methods.hasPendingItems = function () {
  return this.items.some((it) => it.status === ORDER_ITEM_STATUS.NEW);
};

orderSchema.set('toJSON', { virtuals: true, versionKey: false });

module.exports = mongoose.model('Order', orderSchema);
