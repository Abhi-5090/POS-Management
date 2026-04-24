import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Save, Calculator, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';

import Modal from '../Modal';
import Button from '../Button';
import { Field, TextInput, NumberInput, Select, Toggle } from './FormField';
import { money } from '../../utils/format';
import { PAYMENT_METHOD } from '../../utils/constants';

const BILL_STATUSES = ['OPEN', 'PAID', 'CANCELLED', 'REFUNDED'];

/**
 *  Edit Bill Modal (admin)
 *  -----------------------
 *  Edits every user-supplied field on a bill. Derived per-line totals
 *  (`lineTotal`) are recomputed on the backend from price/qty/lineDiscount
 *  so the admin only types three numbers per row.
 *
 *  "Recompute totals from items" button fills subtotal / lineTotal /
 *  tax / total from the items list using the current tax rate — handy
 *  when the admin adjusts quantities and wants the bottom line to
 *  match without typing every number.
 */
export default function EditBillModal({ open, bill, onClose, onSave, saving }) {
  const [form, setForm] = useState(defaults(null));
  useEffect(() => setForm(defaults(bill)), [open, bill]);

  const computedSubtotal = useMemo(() => {
    return (form.items || []).reduce((s, it) => {
      const price = Number(it.price) || 0;
      const qty = Number(it.quantity) || 0;
      const disc = Number(it.lineDiscount) || 0;
      return s + Math.max(0, price * qty - disc);
    }, 0);
  }, [form.items]);

  const computedPaidAmount = useMemo(() => {
    return (form.payments || []).reduce(
      (s, p) => s + (Number(p.amount) || 0),
      0,
    );
  }, [form.payments]);

  const field = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const patchList = (name, updater) =>
    setForm((f) => ({ ...f, [name]: updater(f[name] || []) }));

  const recomputeTotals = () => {
    const sub = round2(computedSubtotal);
    const disc = Number(form.discount) || 0;
    const svc = Number(form.serviceCharge) || 0;
    const taxRate = Number(form.taxRate) || 0;
    const taxable = Math.max(0, sub - disc) + svc;
    const tax = round2(taxable * (taxRate / 100));
    const total = round2(taxable + tax);
    setForm((f) => ({
      ...f,
      subtotal: sub,
      taxAmount: tax,
      cgst: round2(tax / 2),
      sgst: round2(tax / 2),
      total,
      balanceDue: round2(Math.max(0, total - (Number(f.paidAmount) || 0))),
    }));
  };

  const submit = () => {
    onSave({
      customer: {
        name: form.customer.name || '',
        phone: form.customer.phone || '',
      },
      tableNumber: form.tableNumber || null,
      items: (form.items || [])
        .filter((it) => (it.name || '').trim())
        .map((it) => ({
          menuItem: it.menuItem || null,
          name: it.name.trim(),
          price: toNum(it.price),
          quantity: toInt(it.quantity),
          lineDiscount: toNum(it.lineDiscount),
        })),
      subtotal: toNum(form.subtotal),
      discount: toNum(form.discount),
      serviceCharge: toNum(form.serviceCharge),
      taxRate: toNum(form.taxRate),
      taxAmount: toNum(form.taxAmount),
      cgst: toNum(form.cgst),
      sgst: toNum(form.sgst),
      roundingAdjustment: toNum(form.roundingAdjustment),
      total: toNum(form.total),
      payments: (form.payments || [])
        .filter((p) => p.method)
        .map((p) => ({
          method: p.method,
          amount: toNum(p.amount),
          reference: p.reference || '',
          paidAt: p.paidAt || undefined,
        })),
      paidAmount: toNum(form.paidAmount),
      balanceDue: toNum(form.balanceDue),
      status: form.status,
      cancelReason: form.cancelReason || '',
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bill ? `Edit Bill · ${bill.billNumber}` : 'Edit Bill'}
      size="xl"
      footer={
        <>
          <Button
            variant="ghost"
            icon={Calculator}
            onClick={recomputeTotals}
            title="Recompute subtotal / tax / total from items"
          >
            Recompute
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="blue" icon={Save} onClick={submit} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-panel-900 border border-white/5 px-4 py-3 text-xs text-slate-300 flex items-start gap-2">
          <ShieldAlert size={16} className="text-flame-400 shrink-0 mt-0.5" />
          <div>
            Changes save the bill exactly as entered. The DailyReport for this
            bill's date is refreshed automatically. <b>lineTotal</b> is
            recomputed on the backend from price × qty − line discount.
          </div>
        </div>

        {/* Read-only identity row */}
        {bill && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Info label="Invoice" value={bill.invoiceNumber} />
            <Info label="Type" value={bill.orderType} />
            <Info label="Bill #" value={bill.billNumber} />
            <Info label="Created" value={new Date(bill.createdAt).toLocaleString()} />
          </div>
        )}

        {/* Customer */}
        <Section title="Customer">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name">
              <TextInput
                value={form.customer.name}
                onChange={(e) =>
                  field('customer', { ...form.customer, name: e.target.value })
                }
                placeholder="Optional"
              />
            </Field>
            <Field label="Phone">
              <TextInput
                value={form.customer.phone}
                onChange={(e) =>
                  field('customer', { ...form.customer, phone: e.target.value })
                }
                placeholder="Optional"
              />
            </Field>
          </div>
        </Section>

        {/* Items */}
        <Section
          title="Items"
          action={
            <AddRowButton
              onClick={() =>
                patchList('items', (arr) => [
                  ...arr,
                  { name: '', price: 0, quantity: 1, lineDiscount: 0 },
                ])
              }
            />
          }
        >
          {(form.items || []).length === 0 ? (
            <EmptyRow text="No items. Add rows to record what was billed." />
          ) : (
            <div className="space-y-2">
              <RowHeader
                cols={['Item name', 'Price', 'Qty', 'Line disc.', 'Line total', '']}
                template="3fr 1fr 0.8fr 1fr 1fr 2.5rem"
              />
              {(form.items || []).map((row, i) => {
                const lineTotal = Math.max(
                  0,
                  (Number(row.price) || 0) * (Number(row.quantity) || 0) -
                    (Number(row.lineDiscount) || 0),
                );
                return (
                  <div
                    key={i}
                    className="grid items-center gap-2"
                    style={{
                      gridTemplateColumns: '3fr 1fr 0.8fr 1fr 1fr 2.5rem',
                    }}
                  >
                    <TextInput
                      value={row.name}
                      placeholder="Item name"
                      onChange={(e) =>
                        patchList('items', (arr) =>
                          arr.map((r, j) =>
                            j === i ? { ...r, name: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <NumberInput
                      value={row.price}
                      step="0.01"
                      onChange={(e) =>
                        patchList('items', (arr) =>
                          arr.map((r, j) =>
                            j === i ? { ...r, price: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <NumberInput
                      value={row.quantity}
                      min="0"
                      step="1"
                      onChange={(e) =>
                        patchList('items', (arr) =>
                          arr.map((r, j) =>
                            j === i ? { ...r, quantity: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <NumberInput
                      value={row.lineDiscount}
                      step="0.01"
                      onChange={(e) =>
                        patchList('items', (arr) =>
                          arr.map((r, j) =>
                            j === i ? { ...r, lineDiscount: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <div className="text-right tabular-nums text-slate-100 font-semibold px-2 py-2 rounded-lg bg-panel-900 border border-white/5">
                      {money(lineTotal)}
                    </div>
                    <RemoveButton
                      onClick={() =>
                        patchList('items', (arr) =>
                          arr.filter((_, j) => j !== i),
                        )
                      }
                    />
                  </div>
                );
              })}
              <div className="flex items-center justify-end pt-2 text-xs text-slate-400">
                Items sum (preview):{' '}
                <span className="ml-2 text-white font-semibold tabular-nums">
                  {money(computedSubtotal)}
                </span>
              </div>
            </div>
          )}
        </Section>

        {/* Totals */}
        <Section title="Totals">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Subtotal">
              <NumberInput
                value={form.subtotal}
                step="0.01"
                onChange={(e) => field('subtotal', e.target.value)}
              />
            </Field>
            <Field label="Discount">
              <NumberInput
                value={form.discount}
                step="0.01"
                onChange={(e) => field('discount', e.target.value)}
              />
            </Field>
            <Field label="Service charge">
              <NumberInput
                value={form.serviceCharge}
                step="0.01"
                onChange={(e) => field('serviceCharge', e.target.value)}
              />
            </Field>
            <Field label="Tax rate (%)">
              <NumberInput
                value={form.taxRate}
                step="0.01"
                onChange={(e) => field('taxRate', e.target.value)}
              />
            </Field>
            <Field label="Tax amount">
              <NumberInput
                value={form.taxAmount}
                step="0.01"
                onChange={(e) => field('taxAmount', e.target.value)}
              />
            </Field>
            <Field label="Rounding">
              <NumberInput
                value={form.roundingAdjustment}
                step="0.01"
                onChange={(e) => field('roundingAdjustment', e.target.value)}
              />
            </Field>
            <Field label="CGST">
              <NumberInput
                value={form.cgst}
                step="0.01"
                onChange={(e) => field('cgst', e.target.value)}
              />
            </Field>
            <Field label="SGST">
              <NumberInput
                value={form.sgst}
                step="0.01"
                onChange={(e) => field('sgst', e.target.value)}
              />
            </Field>
            <Field label="Total">
              <NumberInput
                value={form.total}
                step="0.01"
                className="text-lg font-bold"
                onChange={(e) => field('total', e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* Payments */}
        <Section
          title="Payments"
          action={
            <AddRowButton
              onClick={() =>
                patchList('payments', (arr) => [
                  ...arr,
                  { method: PAYMENT_METHOD.CASH, amount: 0, reference: '' },
                ])
              }
            />
          }
        >
          {(form.payments || []).length === 0 ? (
            <EmptyRow text="No payments recorded." />
          ) : (
            <div className="space-y-2">
              <RowHeader
                cols={['Method', 'Amount', 'Reference', '']}
                template="1.2fr 1fr 2fr 2.5rem"
              />
              {(form.payments || []).map((row, i) => (
                <div
                  key={i}
                  className="grid items-center gap-2"
                  style={{ gridTemplateColumns: '1.2fr 1fr 2fr 2.5rem' }}
                >
                  <Select
                    value={row.method}
                    onChange={(e) =>
                      patchList('payments', (arr) =>
                        arr.map((r, j) =>
                          j === i ? { ...r, method: e.target.value } : r,
                        ),
                      )
                    }
                  >
                    {Object.values(PAYMENT_METHOD).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                  <NumberInput
                    value={row.amount}
                    step="0.01"
                    onChange={(e) =>
                      patchList('payments', (arr) =>
                        arr.map((r, j) =>
                          j === i ? { ...r, amount: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <TextInput
                    value={row.reference}
                    placeholder="Txn id / last 4"
                    onChange={(e) =>
                      patchList('payments', (arr) =>
                        arr.map((r, j) =>
                          j === i ? { ...r, reference: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <RemoveButton
                    onClick={() =>
                      patchList('payments', (arr) =>
                        arr.filter((_, j) => j !== i),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Field
              label="Paid amount"
              hint={`Payments sum: ${money(computedPaidAmount)}`}
            >
              <NumberInput
                value={form.paidAmount}
                step="0.01"
                onChange={(e) => field('paidAmount', e.target.value)}
              />
            </Field>
            <Field label="Balance due">
              <NumberInput
                value={form.balanceDue}
                step="0.01"
                onChange={(e) => field('balanceDue', e.target.value)}
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => field('status', e.target.value)}
              >
                {BILL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Section>

        {/* Misc */}
        <Section title="Other">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Table number" hint="Dining bills only — leave empty for parcel">
              <TextInput
                value={form.tableNumber || ''}
                onChange={(e) => field('tableNumber', e.target.value)}
                placeholder="e.g. T05"
              />
            </Field>
            <Field label="Cancel reason" hint="Shown on bill history when cancelled">
              <TextInput
                value={form.cancelReason}
                onChange={(e) => field('cancelReason', e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>
        </Section>
      </div>
    </Modal>
  );
}

// ── small pieces ────────────────────────────────────────────────────

function Section({ title, action, children }) {
  return (
    <section className="pos-panel p-4">
      <header className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
        <h4 className="text-white font-bold text-sm">{title}</h4>
        {action}
      </header>
      {children}
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-panel-900 border border-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide font-bold text-slate-500">
        {label}
      </div>
      <div className="text-slate-100 font-semibold truncate">{value}</div>
    </div>
  );
}

function RowHeader({ cols, template }) {
  return (
    <div
      className="grid gap-2 text-[10px] uppercase tracking-wide font-bold text-slate-500 px-1"
      style={{ gridTemplateColumns: template }}
    >
      {cols.map((c, i) => (
        <div key={i}>{c}</div>
      ))}
    </div>
  );
}

function EmptyRow({ text }) {
  return (
    <div className="rounded-lg bg-panel-900 border border-dashed border-white/10 text-slate-400 text-sm px-3 py-4 text-center">
      {text}
    </div>
  );
}

function AddRowButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold tap-btn"
    >
      <Plus size={14} /> Add row
    </button>
  );
}

function RemoveButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 w-10 flex items-center justify-center rounded-lg bg-panel-900 hover:bg-ember-500 hover:text-white text-slate-300 tap-btn"
      title="Remove row"
    >
      <Trash2 size={15} />
    </button>
  );
}

// ── helpers ─────────────────────────────────────────────────────────
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function defaults(bill) {
  return {
    customer: {
      name: bill?.customer?.name || '',
      phone: bill?.customer?.phone || '',
    },
    tableNumber: bill?.tableNumber || '',
    items: (bill?.items || []).map((it) => ({
      menuItem: it.menuItem || null,
      name: it.name || '',
      price: it.price ?? 0,
      quantity: it.quantity ?? 0,
      lineDiscount: it.lineDiscount ?? 0,
    })),
    subtotal: bill?.subtotal ?? 0,
    discount: bill?.discount ?? 0,
    serviceCharge: bill?.serviceCharge ?? 0,
    taxRate: bill?.taxRate ?? 0,
    taxAmount: bill?.taxAmount ?? 0,
    cgst: bill?.cgst ?? 0,
    sgst: bill?.sgst ?? 0,
    roundingAdjustment: bill?.roundingAdjustment ?? 0,
    total: bill?.total ?? 0,
    payments: (bill?.payments || []).map((p) => ({
      method: p.method,
      amount: p.amount ?? 0,
      reference: p.reference || '',
      paidAt: p.paidAt,
    })),
    paidAmount: bill?.paidAmount ?? 0,
    balanceDue: bill?.balanceDue ?? 0,
    status: bill?.status || 'OPEN',
    cancelReason: bill?.cancelReason || '',
  };
}
