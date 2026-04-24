'use strict';

const mongoose = require('mongoose');
const { TABLE_STATUS } = require('./constants');

const tableSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true },
    capacity: { type: Number, default: 4, min: 1 },
    section: { type: String, default: 'Main', trim: true },
    status: {
      type: String,
      enum: Object.values(TABLE_STATUS),
      default: TABLE_STATUS.FREE,
      index: true,
    },
    currentSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TableSession',
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Only *active* tables need a unique number. Inactive (soft-deleted)
// rows keep their number for history without blocking recreations.
tableSchema.index(
  { number: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

tableSchema.virtual('isOccupied').get(function () {
  return this.status === TABLE_STATUS.OCCUPIED;
});

tableSchema.set('toJSON', { virtuals: true, versionKey: false });

module.exports = mongoose.model('Table', tableSchema);
