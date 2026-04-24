'use strict';

const mongoose = require('mongoose');

/**
 *   DailyReport
 *   -----------
 *   One document per *calendar day* holding that day's computed totals
 *   + breakdowns. The admin dashboard / reports page reads from this
 *   collection (so the numbers are visible directly in Mongo) and the
 *   service re-computes + upserts on every bill settlement.
 *
 *   `locked = true` freezes the doc — auto-recompute skips locked rows,
 *   so a manual edit in the admin UI (or directly via Mongo Compass)
 *   will stick. An admin "Regenerate from bills" unlocks + recomputes.
 */

const paymentBreakdown = new mongoose.Schema(
  {
    method: { type: String, required: true },
    amount: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
  },
  { _id: false },
);

const orderTypeBreakdown = new mongoose.Schema(
  {
    type: { type: String, required: true },
    count: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false },
);

const topItem = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: String,
    quantity: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
  },
  { _id: false },
);

const dailyReportSchema = new mongoose.Schema(
  {
    // "YYYY-MM-DD" (local server date) — used as the stable lookup key
    dateKey: { type: String, required: true, unique: true, index: true },
    // Start-of-day Date for range queries
    date: { type: Date, required: true, index: true },

    // Totals (editable)
    revenue: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    serviceCharge: { type: Number, default: 0 },
    billsPaid: { type: Number, default: 0 },

    // Breakdowns (overwritten on recompute unless locked)
    byPaymentMethod: { type: [paymentBreakdown], default: [] },
    byOrderType: { type: [orderTypeBreakdown], default: [] },
    topItems: { type: [topItem], default: [] },

    kotsCount: { type: Number, default: 0 },
    ordersCount: { type: Number, default: 0 },

    // Manual override control
    locked: { type: Boolean, default: false },
    notes: { type: String, default: '' },

    generatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('DailyReport', dailyReportSchema);
