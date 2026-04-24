'use strict';

const { Counter } = require('../models');

function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function nextNumber(prefix, { pad = 4 } = {}) {
  const dk = dateKey();
  const seq = await Counter.next(prefix, dk);
  return `${prefix}-${dk}-${String(seq).padStart(pad, '0')}`;
}

module.exports = {
  nextOrderNumber: () => nextNumber('ORD'),
  nextKotNumber: () => nextNumber('KOT'),
  nextBillNumber: () => nextNumber('BILL'),
  nextInvoiceNumber: () => nextNumber('INV', { pad: 5 }),
  nextSessionCode: () => nextNumber('SES'),
  dateKey,
};
