'use strict';

const AppError = require('../utils/AppError');
const { ORDER_TYPE } = require('../models');
const orderService = require('./orderService');
const kotService = require('./kotService');
const billService = require('./billService');

/**
 * Parcel flow:
 *   1. Create parcel order
 *   2. Add items (merge as usual)
 *   3. placeAndBill():
 *        - ship all NEW items as a single KOT
 *        - generate the bill immediately
 *      (kitchen + counter prints fire from their respective services)
 */

async function createParcelOrder({ customer = {}, createdBy = null }) {
  return orderService.createOrder({
    type: ORDER_TYPE.PARCEL,
    customer,
    createdBy,
  });
}

async function addItem(orderId, payload) {
  const order = await orderService.getOrderById(orderId);
  if (order.type !== ORDER_TYPE.PARCEL) {
    throw AppError.badRequest('Order is not a parcel order');
  }
  return orderService.addItem(orderId, payload);
}

/**
 * "Place Order" for a parcel: sends full current cart to kitchen and
 * immediately generates the bill. A parcel with zero items is rejected.
 */
async function placeAndBill(orderId, { discount = 0, taxRate, serviceCharge = 0, createdBy = null } = {}) {
  const order = await orderService.getOrderById(orderId);
  if (order.type !== ORDER_TYPE.PARCEL) {
    throw AppError.badRequest('Order is not a parcel order');
  }
  if (order.isClosed) throw AppError.conflict('Parcel order already closed');
  if (!order.items.length) throw AppError.unprocessable('No items on this parcel order');

  // Fire the KOT first so kitchen starts immediately, then generate bill.
  const pending = order.items.some((it) => it.status === 'NEW');
  let kot = null;
  if (pending) {
    const result = await kotService.sendToKitchen(order._id, { createdBy });
    kot = result.kot;
  }

  const bill = await billService.generateBill(order._id, {
    discount,
    taxRate,
    serviceCharge,
    createdBy,
  });

  return { bill, kot };
}

module.exports = {
  createParcelOrder,
  addItem,
  placeAndBill,
};
