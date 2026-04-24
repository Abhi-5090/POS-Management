'use strict';

const AppError = require('../utils/AppError');
const {
  Bill,
  Order,
  KOT,
  Table,
  TableSession,
  MenuItem,
  User,
  DailyReport,
  BILL_STATUS,
  SESSION_STATUS,
} = require('../models');

// ── date helpers ─────────────────────────────────────────────────────
function dayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function toDateKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── core aggregation pipeline (reads from bills + kots + orders) ─────
async function computeDailyReportData(date) {
  const { start, end } = dayRange(date);

  const [totals, byPayment, byType, topItems, kotsCount, ordersCount] =
    await Promise.all([
      Bill.aggregate([
        { $match: { status: BILL_STATUS.PAID, paidAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            subtotal: { $sum: '$subtotal' },
            discount: { $sum: '$discount' },
            tax: { $sum: '$taxAmount' },
            total: { $sum: '$total' },
            serviceCharge: { $sum: '$serviceCharge' },
          },
        },
      ]),
      Bill.aggregate([
        { $match: { status: BILL_STATUS.PAID, paidAt: { $gte: start, $lte: end } } },
        { $unwind: '$payments' },
        {
          $group: {
            _id: '$payments.method',
            amount: { $sum: '$payments.amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { amount: -1 } },
      ]),
      Bill.aggregate([
        { $match: { status: BILL_STATUS.PAID, paidAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: '$orderType',
            count: { $sum: 1 },
            total: { $sum: '$total' },
          },
        },
      ]),
      Bill.aggregate([
        { $match: { status: BILL_STATUS.PAID, paidAt: { $gte: start, $lte: end } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.menuItem',
            name: { $first: '$items.name' },
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.lineTotal' },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 10 },
      ]),
      KOT.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      Order.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    ]);

  const t = totals[0] || {};
  return {
    revenue: t.total || 0,
    subtotal: t.subtotal || 0,
    tax: t.tax || 0,
    discount: t.discount || 0,
    serviceCharge: t.serviceCharge || 0,
    billsPaid: t.count || 0,
    byPaymentMethod: byPayment.map((p) => ({
      method: p._id,
      amount: p.amount,
      count: p.count,
    })),
    byOrderType: byType.map((o) => ({
      type: o._id,
      count: o.count,
      total: o.total,
    })),
    topItems: topItems.map((it) => ({
      menuItem: it._id,
      name: it.name,
      quantity: it.quantity,
      revenue: it.revenue,
    })),
    kotsCount,
    ordersCount,
    generatedAt: new Date(),
  };
}

// ── persistence ──────────────────────────────────────────────────────

/**
 * Get-or-recompute the DailyReport for a given date. If the stored doc
 * is LOCKED (admin edited it manually) we return it as-is and the
 * auto-recompute is skipped. Otherwise we recompute from bills and
 * upsert the fresh numbers.
 */
async function ensureDailyReport(date = new Date()) {
  const dateKey = toDateKey(date);
  const existing = await DailyReport.findOne({ dateKey });
  if (existing && existing.locked) return existing;

  const data = await computeDailyReportData(date);
  const dayStart = dayRange(date).start;
  return DailyReport.findOneAndUpdate(
    { dateKey },
    { $set: { ...data, date: dayStart } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

/**
 * Force a fresh recompute + unlock. Admin uses this to throw away any
 * manual edits and snap the doc back to the real bill numbers.
 */
async function regenerateDailyReport(date = new Date()) {
  const dateKey = toDateKey(date);
  const data = await computeDailyReportData(date);
  const dayStart = dayRange(date).start;
  return DailyReport.findOneAndUpdate(
    { dateKey },
    { $set: { ...data, date: dayStart, locked: false, updatedBy: null } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

const EDITABLE = new Set([
  'revenue',
  'subtotal',
  'tax',
  'discount',
  'serviceCharge',
  'billsPaid',
  'byPaymentMethod',
  'byOrderType',
  'topItems',
  'kotsCount',
  'ordersCount',
  'notes',
  'locked',
]);
// Any field that the auto-recompute would overwrite. Touching any of
// these without explicitly setting locked=false should auto-lock the
// report so the admin's manual edits actually persist.
const AUTO_LOCK_FIELDS = new Set([
  'revenue',
  'subtotal',
  'tax',
  'discount',
  'serviceCharge',
  'billsPaid',
  'byPaymentMethod',
  'byOrderType',
  'topItems',
  'kotsCount',
  'ordersCount',
]);

/**
 * Admin patches any subset of editable fields. If income numbers are
 * touched we auto-LOCK the doc, so the next auto-recompute won't blow
 * away the edit. Caller may override by setting locked=false explicitly.
 */
async function updateDailyReport(date, patch = {}, { updatedBy = null } = {}) {
  if (!patch || typeof patch !== 'object') {
    throw AppError.badRequest('patch must be an object');
  }
  await ensureDailyReport(date); // make sure the doc exists
  const dateKey = toDateKey(date);

  const update = {};
  for (const [k, v] of Object.entries(patch)) {
    if (EDITABLE.has(k)) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    throw AppError.badRequest('No editable fields supplied');
  }
  const touchedAutoField = Object.keys(update).some((k) => AUTO_LOCK_FIELDS.has(k));
  if (touchedAutoField && patch.locked === undefined) update.locked = true;
  if (updatedBy) update.updatedBy = updatedBy;

  return DailyReport.findOneAndUpdate({ dateKey }, { $set: update }, { new: true });
}

async function getDailyReport(date) {
  return ensureDailyReport(date);
}

async function listDailyReports({ from, to, page = 1, limit = 30 } = {}) {
  const q = {};
  if (from || to) {
    q.dateKey = {};
    if (from) q.dateKey.$gte = toDateKey(new Date(from));
    if (to) q.dateKey.$lte = toDateKey(new Date(to));
  }
  const skip = (Math.max(1, page) - 1) * limit;
  const [data, total] = await Promise.all([
    DailyReport.find(q).sort({ dateKey: -1 }).skip(skip).limit(limit),
    DailyReport.countDocuments(q),
  ]);
  return { data, total, page, limit };
}

// ── public report endpoints ──────────────────────────────────────────

async function dailySalesReport(date = new Date()) {
  const report = await ensureDailyReport(date);
  return {
    date: report.date,
    dateKey: report.dateKey,
    locked: report.locked,
    notes: report.notes,
    generatedAt: report.generatedAt,
    summary: {
      billsPaid: report.billsPaid,
      subtotal: report.subtotal,
      discount: report.discount,
      tax: report.tax,
      serviceCharge: report.serviceCharge,
      revenue: report.revenue,
    },
    byPaymentMethod: report.byPaymentMethod,
    byOrderType: report.byOrderType,
    topItems: report.topItems,
  };
}

async function kitchenActivityReport(date = new Date()) {
  const { start, end } = dayRange(date);
  const [kots, orders] = await Promise.all([
    KOT.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$kotType',
          count: { $sum: 1 },
          items: { $sum: { $size: '$items' } },
        },
      },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
  ]);
  return { date: start, kots, orders };
}

async function dashboardSummary() {
  const now = new Date();
  const report = await ensureDailyReport(now);
  const { start, end } = dayRange(now);

  const [
    openOrders,
    activeSessions,
    tableStats,
    menuCount,
    staffCount,
    recentBills,
    recentKots,
  ] = await Promise.all([
    Order.countDocuments({ isClosed: false }),
    TableSession.countDocuments({ status: SESSION_STATUS.ACTIVE }),
    Table.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    MenuItem.countDocuments({ isActive: true }),
    User.countDocuments({ isActive: true }),
    Bill.find({}).sort({ createdAt: -1 }).limit(10).lean(),
    KOT.find({ createdAt: { $gte: start, $lte: end } })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
  ]);

  const tableSummary = { free: 0, occupied: 0, reserved: 0, total: 0 };
  for (const row of tableStats) {
    tableSummary[row._id] = row.count;
    tableSummary.total += row.count;
  }

  return {
    date: report.date,
    reportLocked: report.locked,
    reportNotes: report.notes,
    kpis: {
      revenue: report.revenue,
      bills: report.billsPaid,
      tax: report.tax,
      discount: report.discount,
      subtotal: report.subtotal,
      openOrders,
      activeSessions,
      tables: tableSummary,
      menuItems: menuCount,
      staff: staffCount,
    },
    payments: report.byPaymentMethod,
    topItems: (report.topItems || []).slice(0, 5),
    recentBills,
    recentKots,
  };
}

module.exports = {
  dailySalesReport,
  kitchenActivityReport,
  dashboardSummary,
  ensureDailyReport,
  regenerateDailyReport,
  updateDailyReport,
  getDailyReport,
  listDailyReports,
  toDateKey,
};
