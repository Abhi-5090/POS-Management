'use strict';

const EscPosBuilder = require('../escpos');
const config = require('../../config/env');

function money(amount) {
  return `${config.billing.currencySymbol} ${Number(amount || 0).toFixed(2)}`;
}

function renderBill(bill, { width = config.printer.width, reprint = false } = {}) {
  const b = new EscPosBuilder({ width });
  const traceLines = [];
  const trace = (s = '') => traceLines.push(s);

  b.align('CENTER').bold(true).size(EscPosBuilder.SIZE.DOUBLE);
  b.line(config.restaurant.name);
  b.size(EscPosBuilder.SIZE.NORMAL).bold(false);

  if (config.restaurant.address) b.line(config.restaurant.address);
  if (config.restaurant.phone) b.line(`Ph: ${config.restaurant.phone}`);
  if (config.restaurant.gstin) b.line(`GSTIN: ${config.restaurant.gstin}`);
  trace(config.restaurant.name);
  trace(config.restaurant.address);

  b.rule('=');

  b.align('CENTER').bold(true).line(reprint ? 'DUPLICATE RECEIPT' : 'TAX INVOICE').bold(false);
  b.rule('-');

  b.align('LEFT');
  b.kv('Bill No', bill.billNumber);
  b.kv('Invoice', bill.invoiceNumber);
  b.kv('Date', (bill.createdAt || new Date()).toLocaleString());
  if (bill.orderType === 'DINING') {
    b.kv('Table', bill.tableNumber || '-');
  } else {
    b.kv('Type', 'PARCEL');
  }
  if (bill.customer?.name) b.kv('Customer', bill.customer.name);
  if (bill.customer?.phone) b.kv('Phone', bill.customer.phone);

  trace(`Bill ${bill.billNumber}`);
  trace(`Date: ${(bill.createdAt || new Date()).toLocaleString()}`);

  b.rule('-');

  // Header row
  const nameW = width - 18;
  b.bold(true);
  b.line(pad('Item', nameW) + pad('Qty', 4) + pad('Rate', 7, 'right') + pad('Amt', 7, 'right'));
  b.bold(false);
  b.rule('-');

  for (const it of bill.items) {
    // Wrap long names if needed.
    const name = it.name;
    const nameLines = wrapText(name, nameW);
    const first = nameLines[0];
    b.line(
      pad(first, nameW) +
        pad(String(it.quantity), 4) +
        pad(it.price.toFixed(2), 7, 'right') +
        pad(it.lineTotal.toFixed(2), 7, 'right'),
    );
    for (let i = 1; i < nameLines.length; i += 1) b.line(pad(nameLines[i], nameW));
    if (it.lineDiscount) {
      b.line(pad(`  disc`, nameW) + pad('', 4) + pad('', 7) + pad(`-${it.lineDiscount.toFixed(2)}`, 7, 'right'));
    }
    trace(`${name} x${it.quantity}  ${it.lineTotal.toFixed(2)}`);
  }

  b.rule('-');
  b.kv('Subtotal', money(bill.subtotal));
  if (bill.discount) b.kv('Discount', `- ${money(bill.discount)}`);
  if (bill.serviceCharge) b.kv('Service', money(bill.serviceCharge));
  if (bill.taxAmount) {
    if (bill.cgst) b.kv(`CGST`, money(bill.cgst));
    if (bill.sgst) b.kv(`SGST`, money(bill.sgst));
  }
  if (bill.roundingAdjustment) b.kv('Round off', money(bill.roundingAdjustment));

  b.rule('=');
  b.bold(true).size(EscPosBuilder.SIZE.DOUBLE_HEIGHT);
  b.kv('TOTAL', money(bill.total));
  b.size(EscPosBuilder.SIZE.NORMAL).bold(false);
  b.rule('=');
  trace(`TOTAL ${money(bill.total)}`);

  if (bill.payments && bill.payments.length) {
    b.line('Payments:');
    for (const p of bill.payments) {
      b.kv(`  ${p.method}${p.reference ? ` (${p.reference})` : ''}`, money(p.amount));
      trace(`  ${p.method}  ${money(p.amount)}`);
    }
    if (bill.balanceDue > 0) {
      b.bold(true).kv('Balance Due', money(bill.balanceDue)).bold(false);
    }
  }

  b.feed(1);
  b.align('CENTER').line('Thank you. Visit again!');

  b.feed(3).cut();
  return { buffer: b.build(), trace: traceLines.join('\n') };
}

function pad(str, width, align = 'left') {
  const s = String(str ?? '');
  if (s.length >= width) return s.slice(0, width);
  const padCount = width - s.length;
  return align === 'right' ? ' '.repeat(padCount) + s : s + ' '.repeat(padCount);
}

function wrapText(str, width) {
  if (str.length <= width) return [str];
  const out = [];
  let line = '';
  for (const word of String(str).split(/\s+/)) {
    if ((line + ' ' + word).trim().length <= width) {
      line = (line + ' ' + word).trim();
    } else {
      if (line) out.push(line);
      if (word.length > width) {
        out.push(word.slice(0, width));
        line = word.slice(width);
      } else {
        line = word;
      }
    }
  }
  if (line) out.push(line);
  return out;
}

module.exports = { renderBill };
