'use strict';

const mongoose = require('mongoose');

/**
 * Atomic, date-scoped counters for human-friendly numbers:
 *   "ORD", "KOT", "BILL", "INV"
 *
 * Key is "<prefix>:<YYYYMMDD>" so numbers reset daily.
 */
const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

counterSchema.statics.next = async function (prefix, dateKey) {
  const key = `${prefix}:${dateKey}`;
  const doc = await this.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { new: true, upsert: true },
  );
  return doc.value;
};

module.exports = mongoose.model('Counter', counterSchema);
