'use strict';

const AppError = require('../utils/AppError');
const { KOT, KOT_TYPE } = require('../models');
const orderService = require('./orderService');
const { nextKotNumber } = require('./numberingService');
const { emit } = require('../sockets');
const printerService = require('../printer/printerService');
const logger = require('../utils/logger');

/**
 * Dispatches pending (NEW) items on an order to the kitchen:
 *
 *   1. Atomically flips those items to SENT_TO_KITCHEN (via orderService).
 *   2. Persists a KOT record that snapshots exactly what was shipped.
 *   3. Emits `new_kot` on the socket (kitchen display) and a shared
 *      `order_updated` event so counters refresh.
 *   4. Enqueues the print job to the kitchen printer(s).
 *
 * The NEW → SENT transition happens *before* printing so that a printer
 * failure never causes duplicate kitchen lines. Failed prints are
 * retriable via reprintKot().
 */
async function sendToKitchen(orderId, { createdBy = null } = {}) {
  const { order, batchNumber, dispatchedItems } =
    await orderService.dispatchPendingItemsToKitchen(orderId);

  const kotNumber = await nextKotNumber();
  const stations = [...new Set(dispatchedItems.map((it) => it.kitchenStation || 'main'))];

  const kot = await KOT.create({
    kotNumber,
    order: order._id,
    session: order.session,
    tableNumber: order.tableNumber,
    orderType: order.type,
    batchNumber,
    kotType: KOT_TYPE.NEW,
    items: dispatchedItems,
    stations,
    createdBy,
  });

  // fire-and-forget print; retain ability to mark failure on the record
  _printKot(kot).catch((err) => logger.error('KOT print error', { err: err.message }));

  emit('new_kot', {
    kot: _serializeKot(kot),
    order: _serializeOrder(order),
    isIncremental: batchNumber > 1,
  });
  emit('order_updated', { order: _serializeOrder(order), reason: 'KOT_DISPATCHED' });

  return { kot, order };
}

async function reprintKot(kotId, { createdBy = null } = {}) {
  const original = await KOT.findById(kotId);
  if (!original) throw AppError.notFound('KOT not found');

  const kotNumber = await nextKotNumber();
  const copy = await KOT.create({
    kotNumber,
    order: original.order,
    session: original.session,
    tableNumber: original.tableNumber,
    orderType: original.orderType,
    batchNumber: original.batchNumber,
    kotType: KOT_TYPE.REPRINT,
    parentKot: original._id,
    items: original.items,
    stations: original.stations,
    createdBy,
  });

  _printKot(copy).catch((err) => logger.error('KOT reprint error', { err: err.message }));
  emit('new_kot', { kot: _serializeKot(copy), isReprint: true });
  return copy;
}

async function listKotsForOrder(orderId) {
  return KOT.find({ order: orderId }).sort({ batchNumber: 1, createdAt: 1 });
}

async function listPendingKots({ limit = 50 } = {}) {
  return KOT.find({ printStatus: { $in: ['PENDING', 'FAILED'] } })
    .sort({ createdAt: 1 })
    .limit(limit);
}

/** Stream of today's KOTs for the kitchen display (sorted oldest → newest). */
async function listTodayKots() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return KOT.find({ createdAt: { $gte: start } }).sort({ createdAt: 1 });
}

/**
 *   Delete a KOT record. Restricted to REPRINT tickets by default —
 *   originals (NEW) represent a real dispatch event tied to order
 *   items and must never be silently removed.
 *
 *   Safeguard can be overridden with { allowOriginal: true } by admin
 *   tooling if we ever need to clean up pollution.
 */
async function deleteKot(kotId, { allowOriginal = false } = {}) {
  const kot = await KOT.findById(kotId);
  if (!kot) throw AppError.notFound('KOT not found');
  if (kot.kotType !== KOT_TYPE.REPRINT && !allowOriginal) {
    throw AppError.conflict(
      `Only REPRINT KOTs may be deleted. This is a ${kot.kotType} ticket — cancel the underlying items instead.`,
    );
  }
  await KOT.deleteOne({ _id: kot._id });
  emit('kot_deleted', {
    kotId: kot._id,
    kotNumber: kot.kotNumber,
    kotType: kot.kotType,
    orderId: kot.order,
  });
  return { deleted: true, kotNumber: kot.kotNumber };
}

async function _printKot(kot) {
  try {
    await printerService.printKOT(kot);
    kot.printStatus = 'PRINTED';
    kot.printedAt = new Date();
    kot.printAttempts += 1;
    kot.printError = '';
    await kot.save();
  } catch (err) {
    kot.printStatus = 'FAILED';
    kot.printAttempts += 1;
    kot.printError = err.message;
    await kot.save();
    emit('kot_print_failed', { kotId: kot._id, kotNumber: kot.kotNumber, error: err.message });
    throw err;
  }
}

function _serializeKot(kot) {
  const o = kot.toObject ? kot.toObject() : kot;
  return o;
}

function _serializeOrder(order) {
  return order.toObject ? order.toObject({ virtuals: true }) : order;
}

module.exports = {
  sendToKitchen,
  reprintKot,
  deleteKot,
  listKotsForOrder,
  listPendingKots,
  listTodayKots,
};
