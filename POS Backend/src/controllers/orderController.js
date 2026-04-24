'use strict';

const AppError = require('../utils/AppError');
const orderService = require('../services/orderService');
const kotService = require('../services/kotService');
const { Order } = require('../models');
const { emit } = require('../sockets');

async function getOrder(req, res) {
  const order = await orderService.getOrderById(req.params.id);
  // Populate the seat label so the UI can render "Table T05-A".
  await order.populate({ path: 'session', select: 'seatLabel sessionCode' });
  res.json({ success: true, data: order });
}

async function listOpenOrders(req, res) {
  const q = { isClosed: false };
  if (req.query.type) q.type = req.query.type;
  const orders = await Order.find(q).sort({ createdAt: 1 });
  res.json({ success: true, data: orders });
}

async function addItem(req, res) {
  const { menuItemId, quantity, notes } = req.body;
  const order = await orderService.addItem(req.params.id, {
    menuItemId,
    quantity,
    notes,
    addedBy: req.user._id,
  });
  emit('order_updated', { order: order.toJSON(), reason: 'ITEM_ADDED' });
  res.json({ success: true, data: order });
}

async function updateItemQuantity(req, res) {
  const order = await orderService.updateItemQuantity(
    req.params.id,
    req.params.itemId,
    req.body.quantity,
  );
  emit('order_updated', { order: order.toJSON(), reason: 'ITEM_QTY_UPDATED' });
  res.json({ success: true, data: order });
}

async function removeItem(req, res) {
  const order = await orderService.removeItem(req.params.id, req.params.itemId);
  emit('order_updated', { order: order.toJSON(), reason: 'ITEM_REMOVED' });
  res.json({ success: true, data: order });
}

async function cancelItem(req, res) {
  const order = await orderService.cancelItem(req.params.id, req.params.itemId, {
    reason: req.body.reason,
  });
  emit('order_updated', { order: order.toJSON(), reason: 'ITEM_CANCELLED' });
  res.json({ success: true, data: order });
}

async function updateItemStatus(req, res) {
  const { status } = req.body;
  if (!status) throw AppError.badRequest('status required');
  const order = await orderService.updateItemStatus(
    req.params.id,
    req.params.itemId,
    status,
  );
  emit('order_updated', { order: order.toJSON(), reason: 'ITEM_STATUS_UPDATED' });
  res.json({ success: true, data: order });
}

async function sendToKitchen(req, res) {
  const { kot, order } = await kotService.sendToKitchen(req.params.id, {
    createdBy: req.user._id,
  });
  res.json({ success: true, data: { kot, order } });
}

async function previewPendingKot(req, res) {
  const order = await orderService.getOrderById(req.params.id);
  res.json({ success: true, data: { items: orderService.pendingItems(order) } });
}

module.exports = {
  getOrder,
  listOpenOrders,
  addItem,
  updateItemQuantity,
  removeItem,
  cancelItem,
  updateItemStatus,
  sendToKitchen,
  previewPendingKot,
};
