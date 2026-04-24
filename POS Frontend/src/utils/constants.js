export const ORDER_ITEM_STATUS = {
  NEW: 'NEW',
  SENT_TO_KITCHEN: 'SENT_TO_KITCHEN',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  CANCELLED: 'CANCELLED',
};

export const ORDER_TYPE = { DINING: 'DINING', PARCEL: 'PARCEL' };

export const TABLE_STATUS = {
  FREE: 'free',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
};

export const SESSION_STATUS = { ACTIVE: 'active', CLOSED: 'closed' };

export const PAYMENT_METHOD = {
  CASH: 'CASH',
  CARD: 'CARD',
  UPI: 'UPI',
  WALLET: 'WALLET',
  SPLIT: 'SPLIT',
  OTHER: 'OTHER',
};

export const USER_ROLE = {
  ADMIN: 'admin',
  CASHIER: 'cashier',
  KITCHEN: 'kitchen',
  WAITER: 'waiter',
};

export const STATUS_LABEL = {
  NEW: 'New',
  SENT_TO_KITCHEN: 'Sent',
  PREPARING: 'Preparing',
  READY: 'Ready',
  SERVED: 'Served',
  CANCELLED: 'Cancelled',
};

export const STATUS_COLOR = {
  NEW: 'bg-flame-500/20 text-flame-400 border border-flame-500/30',
  SENT_TO_KITCHEN: 'bg-brand-500/20 text-brand-100 border border-brand-500/30',
  PREPARING: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  READY: 'bg-leaf-500/20 text-leaf-500 border border-leaf-500/30',
  SERVED: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
  CANCELLED: 'bg-ember-500/20 text-ember-500 border border-ember-500/30',
};
