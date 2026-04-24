'use strict';

const parcelService = require('../services/parcelService');
const orderService = require('../services/orderService');
const { emit } = require('../sockets');

async function create(req, res) {
  const order = await parcelService.createParcelOrder({
    customer: req.body.customer || {},
    createdBy: req.user._id,
  });
  emit('order_updated', { order: order.toJSON(), reason: 'PARCEL_CREATED' });
  res.status(201).json({ success: true, data: order });
}

async function addItem(req, res) {
  const { menuItemId, quantity, notes } = req.body;
  const order = await parcelService.addItem(req.params.id, {
    menuItemId,
    quantity,
    notes,
    addedBy: req.user._id,
  });
  emit('order_updated', { order: order.toJSON(), reason: 'PARCEL_ITEM_ADDED' });
  res.json({ success: true, data: order });
}

async function updateItemQuantity(req, res) {
  const order = await orderService.updateItemQuantity(
    req.params.id,
    req.params.itemId,
    req.body.quantity,
  );
  emit('order_updated', { order: order.toJSON(), reason: 'PARCEL_ITEM_QTY_UPDATED' });
  res.json({ success: true, data: order });
}

async function removeItem(req, res) {
  const order = await orderService.removeItem(req.params.id, req.params.itemId);
  emit('order_updated', { order: order.toJSON(), reason: 'PARCEL_ITEM_REMOVED' });
  res.json({ success: true, data: order });
}

async function placeAndBill(req, res) {
  const result = await parcelService.placeAndBill(req.params.id, {
    discount: req.body.discount,
    taxRate: req.body.taxRate,
    serviceCharge: req.body.serviceCharge,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data: result });
}

module.exports = { create, addItem, updateItemQuantity, removeItem, placeAndBill };
