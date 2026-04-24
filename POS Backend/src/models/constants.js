'use strict';

const ORDER_ITEM_STATUS = Object.freeze({
  NEW: 'NEW',
  SENT_TO_KITCHEN: 'SENT_TO_KITCHEN',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  CANCELLED: 'CANCELLED',
});

const SESSION_STATUS = Object.freeze({
  ACTIVE: 'active',
  CLOSED: 'closed',
});

const TABLE_STATUS = Object.freeze({
  FREE: 'free',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
});

const BILL_STATUS = Object.freeze({
  OPEN: 'OPEN',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
});

const ORDER_TYPE = Object.freeze({
  DINING: 'DINING',
  PARCEL: 'PARCEL',
});

const PAYMENT_METHOD = Object.freeze({
  CASH: 'CASH',
  CARD: 'CARD',
  UPI: 'UPI',
  WALLET: 'WALLET',
  SPLIT: 'SPLIT',
  OTHER: 'OTHER',
});

const USER_ROLE = Object.freeze({
  ADMIN: 'admin',
  CASHIER: 'cashier',
  KITCHEN: 'kitchen',
  WAITER: 'waiter',
});

const KOT_TYPE = Object.freeze({
  NEW: 'NEW',
  REPRINT: 'REPRINT',
  CANCEL: 'CANCEL',
});

module.exports = {
  ORDER_ITEM_STATUS,
  SESSION_STATUS,
  TABLE_STATUS,
  BILL_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  USER_ROLE,
  KOT_TYPE,
};
