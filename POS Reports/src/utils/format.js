const CURRENCY_SYMBOL = import.meta.env.VITE_CURRENCY_SYMBOL || '₹';

export function money(n) {
  const v = Number(n || 0);
  return `${CURRENCY_SYMBOL}${v.toFixed(2)}`;
}

export function formatDate(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString();
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function isoFromDate(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return isoFromDate(dt);
}
