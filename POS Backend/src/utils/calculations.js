'use strict';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Compute totals for a collection of order items.
 * Each item must expose: price (unit), quantity, and optional lineDiscount.
 *
 *   subtotal = Σ (price * qty - lineDiscount)
 *   discountedSubtotal = subtotal - orderDiscount
 *   tax = discountedSubtotal * (taxRate / 100)
 *   total = discountedSubtotal + tax - (roundingAdjustment || 0)
 */
function computeBillTotals({
  items = [],
  taxRate = 0,
  orderDiscount = 0,
  serviceCharge = 0,
  roundOff = true,
}) {
  let subtotal = 0;
  for (const it of items) {
    const price = Number(it.price) || 0;
    const qty = Number(it.quantity) || 0;
    const ld = Number(it.lineDiscount) || 0;
    subtotal += price * qty - ld;
  }
  subtotal = Math.max(0, subtotal);

  const discountedSubtotal = Math.max(0, subtotal - Number(orderDiscount || 0));
  const taxable = discountedSubtotal + Number(serviceCharge || 0);
  const taxAmount = taxable * (Number(taxRate || 0) / 100);

  // Split GST equally into CGST + SGST (common pattern in India)
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;

  let total = taxable + taxAmount;
  let roundingAdjustment = 0;
  if (roundOff) {
    const rounded = Math.round(total);
    roundingAdjustment = round2(rounded - total);
    total = rounded;
  }

  return {
    subtotal: round2(subtotal),
    discount: round2(orderDiscount || 0),
    serviceCharge: round2(serviceCharge || 0),
    taxRate: Number(taxRate || 0),
    taxAmount: round2(taxAmount),
    cgst: round2(cgst),
    sgst: round2(sgst),
    roundingAdjustment: round2(roundingAdjustment),
    total: round2(total),
  };
}

module.exports = { computeBillTotals, round2 };
