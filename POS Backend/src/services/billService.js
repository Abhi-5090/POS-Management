'use strict';

const AppError = require('../utils/AppError');
const {
  Bill,
  Order,
  BILL_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  ORDER_ITEM_STATUS,
} = require('../models');
const orderService = require('./orderService');
const sessionService = require('./sessionService');
const { nextBillNumber, nextInvoiceNumber } = require('./numberingService');
const { computeBillTotals, round2 } = require('../utils/calculations');
const config = require('../config/env');
const printerService = require('../printer/printerService');
const { emit } = require('../sockets');
const logger = require('../utils/logger');

/**
 *   generateBill(orderId, { taxRate?, discount?, serviceCharge?, createdBy? })
 *
 * - Freezes the billable items into the Bill document (historical snapshot).
 * - Closes the underlying order (no more edits).
 * - Emits `bill_generated` and queues a counter-printer job.
 * - Session is closed only after the bill is settled (see settleBill).
 */
async function generateBill(orderId, opts = {}) {
  const order = await orderService.getOrderById(orderId);
  const items = orderService.assertBillable(order);

  const taxRate = opts.taxRate ?? config.billing.defaultTaxRate;
  const discount = opts.discount || 0;
  const serviceCharge = opts.serviceCharge || 0;

  const totals = computeBillTotals({
    items: items.map((it) => ({
      price: it.price,
      quantity: it.quantity,
      lineDiscount: it.lineDiscount,
    })),
    taxRate,
    orderDiscount: discount,
    serviceCharge,
    roundOff: true,
  });

  const billNumber = await nextBillNumber();
  const invoiceNumber = await nextInvoiceNumber();

  const bill = await Bill.create({
    billNumber,
    invoiceNumber,
    orderType: order.type,
    session: order.session,
    order: order._id,
    table: order.table,
    tableNumber: order.tableNumber,
    customer: order.customer || {},
    items: items.map((it) => ({
      menuItem: it.menuItem,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      lineDiscount: it.lineDiscount || 0,
      lineTotal: round2(it.price * it.quantity - (it.lineDiscount || 0)),
    })),
    subtotal: totals.subtotal,
    discount: totals.discount,
    serviceCharge: totals.serviceCharge,
    taxRate: totals.taxRate,
    taxAmount: totals.taxAmount,
    cgst: totals.cgst,
    sgst: totals.sgst,
    roundingAdjustment: totals.roundingAdjustment,
    total: totals.total,
    balanceDue: totals.total,
    status: BILL_STATUS.OPEN,
    createdBy: opts.createdBy || null,
  });

  await orderService.closeOrder(order._id, { billId: bill._id });

  _printBill(bill).catch((err) => logger.error('Bill print error', { err: err.message }));

  emit('bill_generated', {
    bill: bill.toObject(),
    orderId: order._id,
    sessionId: order.session,
  });

  return bill;
}

/**
 *   settleBill(billId, { payments: [{method, amount, reference}], ... })
 *
 * Accepts full or split payments. If fully settled, the bill is marked
 * PAID and the linked table session (if any) is closed, freeing the table.
 */
async function settleBill(billId, { payments = [], settledBy = null } = {}) {
  const bill = await Bill.findById(billId);
  if (!bill) throw AppError.notFound('Bill not found');
  if (bill.status === BILL_STATUS.PAID) throw AppError.conflict('Bill already settled');
  if (bill.status === BILL_STATUS.CANCELLED) throw AppError.conflict('Bill is cancelled');

  if (!Array.isArray(payments) || payments.length === 0) {
    throw AppError.badRequest('At least one payment is required');
  }

  let paidNow = 0;
  for (const p of payments) {
    if (!Object.values(PAYMENT_METHOD).includes(p.method)) {
      throw AppError.badRequest(`Invalid payment method: ${p.method}`);
    }
    const amount = Number(p.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw AppError.badRequest('Payment amount must be positive');
    }
    paidNow += amount;
    bill.payments.push({
      method: p.method,
      amount: round2(amount),
      reference: p.reference || '',
      paidAt: new Date(),
    });
  }

  bill.paidAmount = round2(bill.paidAmount + paidNow);
  bill.balanceDue = round2(Math.max(0, bill.total - bill.paidAmount));

  if (bill.paidAmount + 0.009 >= bill.total) {
    bill.status = BILL_STATUS.PAID;
    bill.paidAt = new Date();
    bill.settledBy = settledBy;
  }

  await bill.save();

  if (bill.status === BILL_STATUS.PAID && bill.session) {
    await sessionService.closeSession(bill.session, { closedBy: settledBy, billId: bill._id });
  }

  // Keep the day's DailyReport in sync with every paid bill. Lazy-require
  // to avoid any cycle at module load.
  if (bill.status === BILL_STATUS.PAID && bill.paidAt) {
    try {
      const reportService = require('./reportService');
      await reportService.ensureDailyReport(bill.paidAt);
    } catch (err) {
      logger.warn('DailyReport refresh skipped', { err: err.message });
    }
  }

  emit('bill_settled', {
    billId: bill._id,
    billNumber: bill.billNumber,
    status: bill.status,
    balanceDue: bill.balanceDue,
    sessionId: bill.session || null,
    tableId: bill.table || null,
    tableNumber: bill.tableNumber || null,
  });

  return bill;
}

async function cancelBill(billId, { reason = '', cancelledBy = null } = {}) {
  const bill = await Bill.findById(billId);
  if (!bill) throw AppError.notFound('Bill not found');
  if (bill.status === BILL_STATUS.PAID) throw AppError.conflict('Cannot cancel a paid bill');
  if (bill.status === BILL_STATUS.CANCELLED) return bill;

  bill.status = BILL_STATUS.CANCELLED;
  bill.cancelledAt = new Date();
  bill.cancelReason = reason;
  bill.settledBy = cancelledBy;
  await bill.save();

  // Cancellation can affect an already-generated report for its date.
  try {
    const reportService = require('./reportService');
    await reportService.ensureDailyReport(bill.createdAt);
  } catch (err) {
    logger.warn('DailyReport refresh skipped', { err: err.message });
  }

  // Revive the dining session: generating a bill closed the order, but
  // now that the bill is cancelled the table should stay usable. Spawn
  // a fresh open order on the same session so the cashier can continue
  // adding items / generating a new bill.
  if (bill.session && bill.orderType === 'DINING') {
    try {
      const { TableSession, SESSION_STATUS, ORDER_TYPE } = require('../models');
      const session = await TableSession.findById(bill.session);
      if (session && session.status === SESSION_STATUS.ACTIVE) {
        const existingOpen = await orderService.getActiveOrderForSession(session._id);
        if (!existingOpen) {
          const newOrder = await orderService.createOrder({
            type: ORDER_TYPE.DINING,
            session: session._id,
            table: session.table,
            tableNumber: session.tableNumber,
            createdBy: cancelledBy,
          });
          session.order = newOrder._id;
          session.bill = null;
          await session.save();
          logger.info(
            `cancelBill: spawned fresh order ${newOrder.orderNumber} on session ${session.sessionCode}`,
          );
        }
      }
    } catch (err) {
      logger.warn('cancelBill: could not revive session', { err: err.message });
    }
  }

  emit('bill_cancelled', {
    billId: bill._id,
    billNumber: bill.billNumber,
    sessionId: bill.session || null,
  });
  return bill;
}

async function reprintBill(billId) {
  const bill = await Bill.findById(billId);
  if (!bill) throw AppError.notFound('Bill not found');
  await _printBill(bill, { reprint: true });
  return bill;
}

async function getBillById(billId) {
  const bill = await Bill.findById(billId);
  if (!bill) throw AppError.notFound('Bill not found');
  return bill;
}

/**
 *   Admin bill edit. Allows changing every field that a manager might
 *   need to correct after the fact — customer info, individual line
 *   items, totals, payments, status, notes.
 *
 *   Derived fields:
 *     - Each item's `lineTotal` is recomputed from `price·qty − lineDiscount`
 *       so the admin only has to type those three.
 *     - `paidAmount` auto-sums the payments array unless explicitly
 *       provided in the patch.
 *     - `balanceDue` auto-recomputes unless explicitly provided.
 *
 *   Protected fields (rejected silently): billNumber, invoiceNumber,
 *   order, session, orderType, createdBy, _id, createdAt.
 *
 *   After save, the bill's DailyReport document is refreshed so the
 *   admin's revenue / payment breakdown stays in sync.
 */
async function updateBill(billId, patch = {}, { updatedBy = null } = {}) {
  if (!patch || typeof patch !== 'object') {
    throw AppError.badRequest('patch must be an object');
  }
  const bill = await Bill.findById(billId);
  if (!bill) throw AppError.notFound('Bill not found');

  // Customer
  if (patch.customer && typeof patch.customer === 'object') {
    bill.customer = {
      name: patch.customer.name ?? bill.customer?.name ?? '',
      phone: patch.customer.phone ?? bill.customer?.phone ?? '',
    };
  }

  // Items — whole-array replacement, recomputed lineTotals.
  if (Array.isArray(patch.items)) {
    bill.items = patch.items.map((it) => {
      const price = Number(it.price) || 0;
      const quantity = Number(it.quantity) || 0;
      const lineDiscount = Number(it.lineDiscount) || 0;
      const lineTotal = Number.isFinite(Number(it.lineTotal))
        ? Number(it.lineTotal)
        : round2(Math.max(0, price * quantity - lineDiscount));
      return {
        menuItem: it.menuItem || undefined,
        name: (it.name || '').trim(),
        price,
        quantity,
        lineDiscount,
        lineTotal,
      };
    });
  }

  // Scalar totals (accepted as-is so admin retains full control).
  const scalars = [
    'subtotal',
    'discount',
    'serviceCharge',
    'taxRate',
    'taxAmount',
    'cgst',
    'sgst',
    'roundingAdjustment',
    'total',
    'tableNumber',
    'cancelReason',
    'printStatus',
  ];
  for (const k of scalars) {
    if (patch[k] !== undefined) bill[k] = patch[k];
  }

  // Payments replacement.
  let paymentsChanged = false;
  if (Array.isArray(patch.payments)) {
    bill.payments = patch.payments.map((p) => ({
      method: p.method,
      amount: round2(Number(p.amount) || 0),
      reference: p.reference || '',
      paidAt: p.paidAt ? new Date(p.paidAt) : new Date(),
    }));
    paymentsChanged = true;
    // Auto-sum paidAmount unless admin explicitly overrides.
    if (patch.paidAmount === undefined) {
      bill.paidAmount = round2(bill.payments.reduce((s, p) => s + p.amount, 0));
    }
  }
  if (patch.paidAmount !== undefined) {
    bill.paidAmount = round2(Number(patch.paidAmount) || 0);
    paymentsChanged = true;
  }

  // Recompute balanceDue unless explicit.
  if (patch.balanceDue !== undefined) {
    bill.balanceDue = round2(Number(patch.balanceDue) || 0);
  } else if (
    paymentsChanged ||
    patch.total !== undefined ||
    patch.items !== undefined
  ) {
    bill.balanceDue = round2(Math.max(0, bill.total - bill.paidAmount));
  }

  // Status transitions — stamp paidAt / cancelledAt / settledBy.
  if (patch.status !== undefined) {
    if (!Object.values(BILL_STATUS).includes(patch.status)) {
      throw AppError.badRequest(`Invalid status: ${patch.status}`);
    }
    const prev = bill.status;
    bill.status = patch.status;
    if (patch.status === BILL_STATUS.PAID && prev !== BILL_STATUS.PAID) {
      bill.paidAt = bill.paidAt || new Date();
      bill.settledBy = updatedBy;
    }
    if (patch.status === BILL_STATUS.CANCELLED && prev !== BILL_STATUS.CANCELLED) {
      bill.cancelledAt = bill.cancelledAt || new Date();
    }
    if (patch.status === BILL_STATUS.OPEN) {
      // Re-opening a bill — clear timestamps that imply closure.
      if (patch.paidAt === undefined) bill.paidAt = null;
    }
  }

  await bill.save();

  // Refresh DailyReport for the bill's date (respects lock).
  try {
    const reportService = require('./reportService');
    await reportService.ensureDailyReport(bill.paidAt || bill.createdAt);
  } catch (err) {
    logger.warn('DailyReport refresh skipped after edit', { err: err.message });
  }

  emit('bill_updated', {
    billId: bill._id,
    billNumber: bill.billNumber,
    status: bill.status,
  });

  return bill;
}

async function listBills({ from, to, status, orderType, page = 1, limit = 50 } = {}) {
  const q = {};
  if (status) q.status = status;
  if (orderType) q.orderType = orderType;
  if (from || to) {
    q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);
  }
  const skip = (Math.max(1, page) - 1) * limit;
  const [data, total] = await Promise.all([
    Bill.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Bill.countDocuments(q),
  ]);
  return { data, total, page, limit };
}

async function _printBill(bill, { reprint = false } = {}) {
  try {
    await printerService.printBill(bill, { reprint });
    bill.printStatus = 'PRINTED';
    bill.printedAt = new Date();
    await bill.save();
  } catch (err) {
    bill.printStatus = 'FAILED';
    await bill.save();
    emit('bill_print_failed', {
      billId: bill._id,
      billNumber: bill.billNumber,
      error: err.message,
    });
    throw err;
  }
}

module.exports = {
  generateBill,
  settleBill,
  cancelBill,
  reprintBill,
  updateBill,
  getBillById,
  listBills,
};
