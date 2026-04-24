const CURRENCY_SYMBOL = import.meta.env.VITE_CURRENCY_SYMBOL || '₹';

export function money(n) {
  const v = Number(n || 0);
  return `${CURRENCY_SYMBOL}${v.toFixed(2)}`;
}

export function moneyNeg(n) {
  const v = Number(n || 0);
  return `- ${CURRENCY_SYMBOL}${v.toFixed(2)}`;
}

export function formatDate(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString();
}

export function shortId(s) {
  if (!s) return '';
  return String(s).slice(-6).toUpperCase();
}

export function pluralize(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
