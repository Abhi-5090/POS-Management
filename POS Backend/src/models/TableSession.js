'use strict';

const mongoose = require('mongoose');
const { SESSION_STATUS } = require('./constants');

const SEAT_LABELS = ['A', 'B', 'C', 'D'];

const tableSessionSchema = new mongoose.Schema(
  {
    sessionCode: { type: String, required: true, unique: true, index: true },
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
      index: true,
    },
    tableNumber: { type: String, required: true },
    /**
     *   Seat label for split-table mode.
     *     - null  →  session covers the whole table (default / un-split)
     *     - 'A'…'D' → independent seat on a shared physical table, each
     *                 with its own order + KOTs + bill
     *
     *   Rule enforced by sessionService: a table may NOT have a
     *   null-seat session and a non-null-seat session active at the
     *   same time. Either one whole-table session, or up to 4 seat
     *   sessions.
     */
    seatLabel: {
      type: String,
      enum: [...SEAT_LABELS, null],
      default: null,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null },

    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.ACTIVE,
      index: true,
    },
    guests: { type: Number, default: 1, min: 1 },
    notes: { type: String, default: '' },

    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Virtual: "T05" for whole, "T05-A" for seated.
tableSessionSchema.virtual('displayLabel').get(function () {
  return this.seatLabel ? `${this.tableNumber}-${this.seatLabel}` : this.tableNumber;
});
tableSessionSchema.set('toJSON', { virtuals: true, versionKey: false });

/**
 *   At most one active session per (table, seatLabel) pair:
 *   - One whole-table session (seatLabel=null) OR
 *   - One session per seat (A, B, C, D)
 *   Each seat label is independent; null counts as its own slot.
 */
tableSessionSchema.index(
  { table: 1, seatLabel: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: SESSION_STATUS.ACTIVE },
  },
);

tableSessionSchema.statics.SEAT_LABELS = SEAT_LABELS;

module.exports = mongoose.model('TableSession', tableSessionSchema);
module.exports.SEAT_LABELS = SEAT_LABELS;
