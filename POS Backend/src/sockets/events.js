'use strict';

exports.ROOMS = Object.freeze({
  COUNTER: 'counter',
  KITCHEN: 'kitchen',
  WAITER: 'waiter',
  ADMIN: 'admin',
});

exports.EVENTS = Object.freeze({
  NEW_KOT: 'new_kot',
  KOT_ACK: 'kot_ack',
  KOT_PRINT_FAILED: 'kot_print_failed',
  KOT_DELETED: 'kot_deleted',

  ORDER_UPDATED: 'order_updated',

  BILL_GENERATED: 'bill_generated',
  BILL_SETTLED: 'bill_settled',
  BILL_CANCELLED: 'bill_cancelled',
  BILL_PRINT_FAILED: 'bill_print_failed',

  SESSION_OPENED: 'session_opened',
  SESSION_CLOSED: 'session_closed',
  SESSION_REOPENED: 'session_reopened',
});
