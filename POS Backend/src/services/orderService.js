'use strict';

const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const {
  Order,
  MenuItem,
  TableSession,
  ORDER_TYPE,
  ORDER_ITEM_STATUS,
  SESSION_STATUS,
} = require('../models');
const { nextOrderNumber } = require('./numberingService');

/**
 * Order service: the single source of truth for anything that mutates
 * an Order's items list. All mutations go through here so the
 * incremental-KOT invariants hold:
 *
 *   • An item's status tells you whether the kitchen already knows about it.
 *   • The `NEW` subset is the only slice that a "Send to Kitchen" click
 *     may ever dispatch.
 *   • Adding the same item twice while still NEW just bumps quantity —
 *     no duplicate lines in the cart or on the KOT.
 */

// ── internals ─────────────────────────────────────────────────────────
async function _resolveMenuItem(menuItemId) {
  if (!mongoose.isValidObjectId(menuItemId)) {
    throw AppError.badRequest('Invalid menu item id');
  }
  const mi = await MenuItem.findById(menuItemId).populate('category', 'kitchenStation');
  if (!mi) throw AppError.notFound('Menu item not found');
  if (!mi.isActive || !mi.isAvailable) {
    throw AppError.unprocessable(`Menu item '${mi.name}' is not available`);
  }
  return mi;
}

function _station(menuItem) {
  return (
    menuItem.kitchenStation ||
    (menuItem.category && menuItem.category.kitchenStation) ||
    'main'
  ).toLowerCase();
}

// ── public API ────────────────────────────────────────────────────────

/** Create a fresh order. For dining, this is linked to a session. */
async function createOrder({ type, session = null, table = null, tableNumber = null, customer = {}, createdBy = null }) {
  if (!Object.values(ORDER_TYPE).includes(type)) {
    throw AppError.badRequest('Invalid order type');
  }
  const orderNumber = await nextOrderNumber();
  const order = await Order.create({
    orderNumber,
    type,
    session,
    table,
    tableNumber,
    customer,
    createdBy,
  });
  return order;
}

/** Fetch the currently-open order for a dining session, or null. */
async function getActiveOrderForSession(sessionId) {
  return Order.findOne({ session: sessionId, isClosed: false });
}

async function getOrderById(orderId) {
  if (!mongoose.isValidObjectId(orderId)) throw AppError.badRequest('Invalid order id');
  const order = await Order.findById(orderId);
  if (!order) throw AppError.notFound('Order not found');
  return order;
}

/**
 * Add or merge an item into the order.
 *
 * Merge rules:
 *   - If an existing line with the SAME menuItem+notes is still NEW, we
 *     add to its quantity (cart-level merge).
 *   - Otherwise we push a new line (e.g. already-sent items don't silently
 *     absorb new additions — those must travel on a fresh KOT).
 */
async function addItem(orderId, { menuItemId, quantity = 1, notes = '', addedBy = null }) {
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw AppError.badRequest('Quantity must be at least 1');
  }

  const order = await getOrderById(orderId);
  if (order.isClosed) throw AppError.conflict('Order is already closed');

  const menuItem = await _resolveMenuItem(menuItemId);
  const station = _station(menuItem);
  const trimmedNote = (notes || '').trim();

  const mergeable = order.items.find(
    (it) =>
      it.status === ORDER_ITEM_STATUS.NEW &&
      String(it.menuItem) === String(menuItem._id) &&
      (it.notes || '') === trimmedNote,
  );

  if (mergeable) {
    mergeable.quantity += quantity;
  } else {
    order.items.push({
      menuItem: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      quantity,
      kitchenStation: station,
      notes: trimmedNote,
      status: ORDER_ITEM_STATUS.NEW,
      addedBy,
    });
  }

  await order.save();
  return order;
}

/**
 * Update quantity of a NEW item. Sent items can't be silently edited — if
 * the kitchen knows about it, you must cancel & re-add (or increase via
 * another line which will ship on the next KOT).
 */
async function updateItemQuantity(orderId, itemId, quantity) {
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw AppError.badRequest('Quantity must be at least 1');
  }
  const order = await getOrderById(orderId);
  if (order.isClosed) throw AppError.conflict('Order is already closed');

  const item = order.items.id(itemId);
  if (!item) throw AppError.notFound('Item not found in order');
  if (item.status !== ORDER_ITEM_STATUS.NEW) {
    throw AppError.conflict('Cannot modify an item already sent to the kitchen');
  }
  item.quantity = quantity;
  await order.save();
  return order;
}

/** Remove a NEW item outright. (Already-sent items go through cancelItem.) */
async function removeItem(orderId, itemId) {
  const order = await getOrderById(orderId);
  if (order.isClosed) throw AppError.conflict('Order is already closed');

  const item = order.items.id(itemId);
  if (!item) throw AppError.notFound('Item not found in order');
  if (item.status !== ORDER_ITEM_STATUS.NEW) {
    throw AppError.conflict('Use cancelItem for items already sent to the kitchen');
  }
  item.deleteOne();
  await order.save();
  return order;
}

/** Cancel an item that's already on the kitchen side. */
async function cancelItem(orderId, itemId, { reason = '' } = {}) {
  const order = await getOrderById(orderId);
  if (order.isClosed) throw AppError.conflict('Order is already closed');

  const item = order.items.id(itemId);
  if (!item) throw AppError.notFound('Item not found in order');
  if (item.status === ORDER_ITEM_STATUS.CANCELLED) {
    throw AppError.conflict('Item already cancelled');
  }
  if (item.status === ORDER_ITEM_STATUS.SERVED) {
    throw AppError.conflict('Cannot cancel an already-served item');
  }
  item.status = ORDER_ITEM_STATUS.CANCELLED;
  item.cancelledAt = new Date();
  item.cancelledReason = reason || '';
  await order.save();
  return order;
}

/** Change item's kitchen status: SENT→PREPARING→READY→SERVED. */
async function updateItemStatus(orderId, itemId, nextStatus) {
  const allowed = [
    ORDER_ITEM_STATUS.PREPARING,
    ORDER_ITEM_STATUS.READY,
    ORDER_ITEM_STATUS.SERVED,
  ];
  if (!allowed.includes(nextStatus)) {
    throw AppError.badRequest(`Invalid target status '${nextStatus}'`);
  }
  const order = await getOrderById(orderId);
  const item = order.items.id(itemId);
  if (!item) throw AppError.notFound('Item not found');

  if (item.status === ORDER_ITEM_STATUS.NEW) {
    throw AppError.conflict('Item has not been sent to the kitchen yet');
  }
  if (item.status === ORDER_ITEM_STATUS.CANCELLED) {
    throw AppError.conflict('Item is cancelled');
  }

  item.status = nextStatus;
  if (nextStatus === ORDER_ITEM_STATUS.SERVED) item.servedAt = new Date();
  await order.save();
  return order;
}

/**
 * Atomically dispatch all NEW items to the kitchen.
 *
 * Returns:
 *   { order, batchNumber, dispatchedItems: [...] }
 *
 * Caller (KOT service) is responsible for persisting the KOT record,
 * emitting socket events and queuing the print job. This function
 * guarantees the items list has transitioned cleanly before any of that
 * happens, so duplicate KOTs cannot happen.
 */
async function dispatchPendingItemsToKitchen(orderId) {
  const order = await getOrderById(orderId);
  if (order.isClosed) throw AppError.conflict('Order is already closed');

  const pending = order.items.filter((it) => it.status === ORDER_ITEM_STATUS.NEW);
  if (!pending.length) {
    throw AppError.unprocessable('No new items to send to kitchen');
  }

  const batchNumber = order.kotSequence + 1;
  const now = new Date();
  const dispatchedSnapshot = pending.map((it) => ({
    orderItemId: it._id,
    menuItem: it.menuItem,
    name: it.name,
    quantity: it.quantity,
    kitchenStation: it.kitchenStation,
    notes: it.notes,
  }));

  for (const it of pending) {
    it.status = ORDER_ITEM_STATUS.SENT_TO_KITCHEN;
    it.kotBatch = batchNumber;
    it.sentToKitchenAt = now;
  }
  order.kotSequence = batchNumber;
  await order.save();

  return { order, batchNumber, dispatchedItems: dispatchedSnapshot };
}

/** All items still NEW (used to preview what the next KOT will carry). */
function pendingItems(order) {
  return order.items.filter((it) => it.status === ORDER_ITEM_STATUS.NEW);
}

/** Items that are billable (everything except cancelled). */
function billableItems(order) {
  return order.items.filter((it) => it.status !== ORDER_ITEM_STATUS.CANCELLED);
}

/** Validate that order is billable. */
function assertBillable(order) {
  if (order.isClosed) throw AppError.conflict('Order is already closed');
  const billable = billableItems(order);
  if (!billable.length) throw AppError.unprocessable('No billable items on this order');
  if (order.bill) throw AppError.conflict('Bill already generated for this order');
  const hasNew = order.items.some((it) => it.status === ORDER_ITEM_STATUS.NEW);
  if (hasNew) throw AppError.unprocessable('Send all new items to the kitchen before billing');
  return billable;
}

async function closeOrder(orderId, { billId } = {}) {
  const order = await getOrderById(orderId);
  order.isClosed = true;
  order.closedAt = new Date();
  if (billId) order.bill = billId;
  await order.save();

  if (order.session) {
    await TableSession.updateOne(
      { _id: order.session, status: SESSION_STATUS.ACTIVE },
      { $set: { bill: billId || order.bill } },
    );
  }
  return order;
}

module.exports = {
  createOrder,
  getOrderById,
  getActiveOrderForSession,
  addItem,
  updateItemQuantity,
  removeItem,
  cancelItem,
  updateItemStatus,
  dispatchPendingItemsToKitchen,
  pendingItems,
  billableItems,
  assertBillable,
  closeOrder,
};
