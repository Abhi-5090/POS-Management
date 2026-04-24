'use strict';

const mongoose = require('mongoose');
const { KOT_TYPE } = require('./constants');

/**
 * A KOT (Kitchen Order Ticket) is an immutable record of what was
 * *actually shipped* to the kitchen at one point in time.
 *
 * One KOT per "Send to Kitchen" click. Reprints create a KOT with
 * kotType=REPRINT and a pointer to the original. The incremental logic
 * in the order service guarantees the `items` list here is strictly the
 * delta — never the full cart.
 */
const kotItemSnapshotSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    kitchenStation: { type: String, default: 'main' },
    notes: { type: String, default: '' },
    orderItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const kotSchema = new mongoose.Schema(
  {
    kotNumber: { type: String, required: true, unique: true, index: true },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'TableSession', default: null },
    tableNumber: { type: String, default: null },
    orderType: { type: String, required: true },
    batchNumber: { type: Number, required: true },
    kotType: {
      type: String,
      enum: Object.values(KOT_TYPE),
      default: KOT_TYPE.NEW,
      index: true,
    },
    parentKot: { type: mongoose.Schema.Types.ObjectId, ref: 'KOT', default: null },
    items: { type: [kotItemSnapshotSchema], default: [] },

    stations: [{ type: String, lowercase: true }],
    printStatus: {
      type: String,
      enum: ['PENDING', 'PRINTED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    printAttempts: { type: Number, default: 0 },
    printedAt: { type: Date, default: null },
    printError: { type: String, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

kotSchema.index({ order: 1, batchNumber: 1 }, { unique: true, partialFilterExpression: { kotType: 'NEW' } });

module.exports = mongoose.model('KOT', kotSchema);
