import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Calendar,
  Save,
  RefreshCcw,
  Lock,
  Unlock,
  History,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  Plus,
  Trash2,
  Search,
  ChefHat,
  Receipt,
  TrendingUp,
  Flame,
} from 'lucide-react';
import clsx from 'clsx';

import Header from '../components/Header';
import Button from '../components/Button';
import Loader from '../components/Loader';
import {
  Field,
  NumberInput,
  TextInput,
  Toggle,
  Select,
} from '../components/FormField';

import { reportsApi } from '../api/reports';
import { money, formatDate, todayISO, addDays } from '../utils/format';

const PAYMENT_METHODS = ['CASH', 'CARD', 'UPI', 'WALLET', 'SPLIT', 'OTHER'];
const ORDER_TYPES = ['DINING', 'PARCEL'];

/**
 *   Edit Reports — full DailyReport document editor.
 *
 *   Every value visible on the frontend reports is editable here:
 *     • Totals      — Revenue, Subtotal, Tax, Discount, Service, Bills paid
 *     • Kitchen     — KOTs count, Orders count
 *     • Payment split (list of {method, amount, count}, add/remove rows)
 *     • Order-type  (list of {type, count, total}, add/remove rows)
 *     • Top items   (list of {name, quantity, revenue}, add/remove rows)
 *     • Notes, Lock
 *
 *   Saving any substantive field LOCKS the doc so the backend's auto-
 *   recompute (fired on every bill settle) doesn't clobber the manual
 *   edits. "Regenerate from bills" unlocks + recomputes.
 */
export default function EditReportsPage() {
  const { dateKey: param } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const initial = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : todayISO();
  const [date, setDate] = useState(initial);
  const [listSearch, setListSearch] = useState('');

  useEffect(() => {
    navigate(`/${date}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // ── queries ──────────────────────────────────────────────────────
  // Use the raw DailyReport doc so we have the original breakdown
  // arrays + kotsCount + ordersCount (dailySalesReport hides those).
  const { data: raw, isLoading } = useQuery({
    queryKey: ['daily', date],
    queryFn: () => reportsApi.getDaily(date),
  });

  const { data: listPage } = useQuery({
    queryKey: ['daily-list'],
    queryFn: () => reportsApi.listDaily({ limit: 60 }),
  });
  const recentReports = listPage?.data || [];

  // ── form state ───────────────────────────────────────────────────
  const [form, setForm] = useState(defaults(null));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setForm(defaults(raw));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  useEffect(() => {
    setDirty(false);
  }, [date]);

  const locked = !!raw?.locked;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['daily', date] });
    qc.invalidateQueries({ queryKey: ['daily-list'] });
    qc.invalidateQueries({ queryKey: ['daily-sales', date] });
  };

  // ── mutations ────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: (patch) => reportsApi.updateDaily(date, patch),
    onSuccess: () => {
      invalidate();
      toast.success('Report saved to DB');
      setDirty(false);
    },
    onError: (e) => toast.error(e.message || 'Save failed'),
  });

  const regenerate = useMutation({
    mutationFn: () => reportsApi.regenerateDaily(date),
    onSuccess: () => {
      invalidate();
      toast.success('Recomputed from bills');
      setDirty(false);
    },
    onError: (e) => toast.error(e.message || 'Regenerate failed'),
  });

  // ── helpers ──────────────────────────────────────────────────────
  const patchField = (name, value) =>
    setForm((f) => {
      setDirty(true);
      return { ...f, [name]: value };
    });

  const patchList = (name, updater) =>
    setForm((f) => {
      setDirty(true);
      return { ...f, [name]: updater(f[name] || []) };
    });

  const computedTotal = useMemo(() => {
    const sub = Number(form.subtotal) || 0;
    const tax = Number(form.tax) || 0;
    const service = Number(form.serviceCharge) || 0;
    const discount = Number(form.discount) || 0;
    return Math.max(0, sub - discount + service + tax);
  }, [form.subtotal, form.tax, form.serviceCharge, form.discount]);

  const revenueOff =
    Math.abs(computedTotal - (Number(form.revenue) || 0)) > 0.01;

  const handleSave = () => {
    save.mutate({
      revenue: toNum(form.revenue),
      subtotal: toNum(form.subtotal),
      tax: toNum(form.tax),
      discount: toNum(form.discount),
      serviceCharge: toNum(form.serviceCharge),
      billsPaid: toInt(form.billsPaid),
      kotsCount: toInt(form.kotsCount),
      ordersCount: toInt(form.ordersCount),
      byPaymentMethod: (form.byPaymentMethod || [])
        .filter((r) => r.method)
        .map((r) => ({
          method: r.method,
          amount: toNum(r.amount),
          count: toInt(r.count),
        })),
      byOrderType: (form.byOrderType || [])
        .filter((r) => r.type)
        .map((r) => ({
          type: r.type,
          count: toInt(r.count),
          total: toNum(r.total),
        })),
      topItems: (form.topItems || [])
        .filter((r) => (r.name || '').trim())
        .map((r) => ({
          menuItem: r.menuItem || undefined,
          name: r.name.trim(),
          quantity: toInt(r.quantity),
          revenue: toNum(r.revenue),
        })),
      notes: form.notes,
      locked: !!form.locked,
    });
  };

  const handleRegenerate = () => {
    if (
      locked &&
      !window.confirm(
        'This report is LOCKED. Regenerating will discard manual edits and recompute from bills. Continue?',
      )
    ) {
      return;
    }
    if (
      dirty &&
      !window.confirm('You have unsaved changes. Discard and regenerate?')
    ) {
      return;
    }
    regenerate.mutate();
  };

  const filteredReports = useMemo(() => {
    if (!listSearch.trim()) return recentReports;
    const s = listSearch.trim().toLowerCase();
    return recentReports.filter(
      (r) =>
        r.dateKey.toLowerCase().includes(s) ||
        (r.notes || '').toLowerCase().includes(s),
    );
  }, [recentReports, listSearch]);

  // ── render ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-navy-grad flex flex-col">
      <Header
        title="POS Reports"
        subtitle={`Editing DailyReport · ${date}`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDate(addDays(date, -1))}
              className="h-10 w-10 rounded-lg bg-panel-800 hover:bg-panel-700 text-slate-200 flex items-center justify-center tap-btn"
              title="Previous day"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="relative">
              <Calendar
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value || todayISO())}
                className="input-dark pl-9 h-10 text-sm"
                max={todayISO()}
              />
            </div>
            <button
              onClick={() => setDate(addDays(date, 1))}
              disabled={date >= todayISO()}
              className="h-10 w-10 rounded-lg bg-panel-800 hover:bg-panel-700 disabled:opacity-40 text-slate-200 flex items-center justify-center tap-btn"
              title="Next day"
            >
              <ArrowRight size={18} />
            </button>
            <Button variant="ghost" size="sm" onClick={() => setDate(todayISO())}>
              Today
            </Button>
          </div>
        }
      />

      <main className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Sidebar — recent days */}
        <aside className="w-full md:w-72 shrink-0 bg-panel-900 border-r border-white/5 flex flex-col md:max-h-screen">
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search date or notes…"
                className="input-dark pl-9 h-9 text-sm"
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 uppercase tracking-wide font-semibold">
              Recent reports ({listPage?.total || 0})
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredReports.length === 0 ? (
              <div className="text-slate-500 text-sm p-4 text-center">
                No reports yet. They're created on first view or when a bill
                settles.
              </div>
            ) : (
              filteredReports.map((r) => {
                const active = r.dateKey === date;
                return (
                  <button
                    key={r.dateKey}
                    onClick={() => setDate(r.dateKey)}
                    className={clsx(
                      'w-full text-left rounded-lg px-3 py-2.5 tap-btn transition border',
                      active
                        ? 'bg-brand-500 text-white border-brand-500 shadow-btn-blue'
                        : 'bg-panel-800 hover:bg-panel-700 text-slate-200 border-white/5',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm tabular-nums">
                        {r.dateKey}
                      </span>
                      {r.locked && (
                        <Lock
                          size={12}
                          className={active ? 'text-white' : 'text-flame-400'}
                        />
                      )}
                    </div>
                    <div
                      className={clsx(
                        'text-xs mt-0.5 flex items-center justify-between gap-2',
                        active ? 'text-white/80' : 'text-slate-400',
                      )}
                    >
                      <span className="tabular-nums">{money(r.revenue)}</span>
                      <span>{r.billsPaid} bills</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Editor */}
        <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto space-y-5">
          {isLoading ? (
            <Loader label="Loading report…" />
          ) : (
            <>
              {/* Lock banner */}
              <div
                className={clsx(
                  'rounded-xl p-3 flex items-center gap-3 border',
                  locked
                    ? 'bg-flame-500/10 border-flame-500/30'
                    : 'bg-leaf-500/10 border-leaf-500/30',
                )}
              >
                <div
                  className={clsx(
                    'h-9 w-9 rounded-lg flex items-center justify-center',
                    locked
                      ? 'bg-flame-500/20 text-flame-400'
                      : 'bg-leaf-500/20 text-leaf-500',
                  )}
                >
                  {locked ? <Lock size={16} /> : <Unlock size={16} />}
                </div>
                <div className="min-w-0 text-xs text-slate-300 flex-1">
                  <div className="text-white font-semibold text-sm">
                    {locked
                      ? 'Locked · manually adjusted'
                      : 'Auto-updating from bills'}
                  </div>
                  <div>
                    {locked
                      ? "Auto-recompute is skipped until you unlock or regenerate."
                      : 'Totals refresh whenever a bill settles on this date.'}
                    {raw?.generatedAt && (
                      <> · Last generated: {formatDate(raw.generatedAt)}</>
                    )}
                  </div>
                </div>
                {dirty && (
                  <span className="shrink-0 pos-chip bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Unsaved changes
                  </span>
                )}
              </div>

              <Explainer />

              {/* Totals */}
              <FormSection icon={Receipt} title="Totals">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Revenue">
                    <NumberInput
                      value={form.revenue}
                      onChange={(e) => patchField('revenue', e.target.value)}
                      step="0.01"
                    />
                  </Field>
                  <Field label="Bills paid (count)">
                    <NumberInput
                      value={form.billsPaid}
                      onChange={(e) => patchField('billsPaid', e.target.value)}
                      min="0"
                      step="1"
                    />
                  </Field>
                  <Field label="Subtotal">
                    <NumberInput
                      value={form.subtotal}
                      onChange={(e) => patchField('subtotal', e.target.value)}
                      step="0.01"
                    />
                  </Field>
                  <Field label="Tax">
                    <NumberInput
                      value={form.tax}
                      onChange={(e) => patchField('tax', e.target.value)}
                      step="0.01"
                    />
                  </Field>
                  <Field label="Discount">
                    <NumberInput
                      value={form.discount}
                      onChange={(e) => patchField('discount', e.target.value)}
                      step="0.01"
                    />
                  </Field>
                  <Field label="Service charge">
                    <NumberInput
                      value={form.serviceCharge}
                      onChange={(e) =>
                        patchField('serviceCharge', e.target.value)
                      }
                      step="0.01"
                    />
                  </Field>
                </div>
                {revenueOff && (
                  <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-3 py-2">
                    <b>Heads up:</b> subtotal − discount + service + tax ={' '}
                    <span className="tabular-nums font-bold">
                      {money(computedTotal)}
                    </span>
                    , but Revenue is{' '}
                    <span className="tabular-nums font-bold">
                      {money(Number(form.revenue) || 0)}
                    </span>
                    .
                  </div>
                )}
              </FormSection>

              {/* Kitchen counts */}
              <FormSection icon={ChefHat} title="Kitchen activity">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="KOTs (tickets printed)">
                    <NumberInput
                      value={form.kotsCount}
                      onChange={(e) => patchField('kotsCount', e.target.value)}
                      min="0"
                      step="1"
                    />
                  </Field>
                  <Field label="Orders created">
                    <NumberInput
                      value={form.ordersCount}
                      onChange={(e) => patchField('ordersCount', e.target.value)}
                      min="0"
                      step="1"
                    />
                  </Field>
                </div>
              </FormSection>

              {/* By payment method */}
              <FormSection
                icon={TrendingUp}
                title="By payment method"
                action={
                  <AddRowButton
                    onClick={() =>
                      patchList('byPaymentMethod', (arr) => [
                        ...arr,
                        { method: 'CASH', amount: 0, count: 0 },
                      ])
                    }
                  />
                }
              >
                {(form.byPaymentMethod || []).length === 0 ? (
                  <EmptyRow text="No rows. Add one to record a payment split." />
                ) : (
                  <div className="space-y-2">
                    <RowHeader
                      cols={['Method', 'Amount', 'Txn count', '']}
                      template="2fr 1fr 1fr 2.5rem"
                    />
                    {(form.byPaymentMethod || []).map((row, i) => (
                      <div
                        key={i}
                        className="grid items-center gap-2"
                        style={{ gridTemplateColumns: '2fr 1fr 1fr 2.5rem' }}
                      >
                        <Select
                          value={row.method}
                          onChange={(e) =>
                            patchList('byPaymentMethod', (arr) =>
                              arr.map((r, j) =>
                                j === i ? { ...r, method: e.target.value } : r,
                              ),
                            )
                          }
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </Select>
                        <NumberInput
                          value={row.amount}
                          onChange={(e) =>
                            patchList('byPaymentMethod', (arr) =>
                              arr.map((r, j) =>
                                j === i ? { ...r, amount: e.target.value } : r,
                              ),
                            )
                          }
                          step="0.01"
                        />
                        <NumberInput
                          value={row.count}
                          onChange={(e) =>
                            patchList('byPaymentMethod', (arr) =>
                              arr.map((r, j) =>
                                j === i ? { ...r, count: e.target.value } : r,
                              ),
                            )
                          }
                          min="0"
                          step="1"
                        />
                        <RemoveButton
                          onClick={() =>
                            patchList('byPaymentMethod', (arr) =>
                              arr.filter((_, j) => j !== i),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </FormSection>

              {/* By order type */}
              <FormSection
                icon={Flame}
                title="By order type"
                action={
                  <AddRowButton
                    onClick={() =>
                      patchList('byOrderType', (arr) => [
                        ...arr,
                        { type: 'DINING', count: 0, total: 0 },
                      ])
                    }
                  />
                }
              >
                {(form.byOrderType || []).length === 0 ? (
                  <EmptyRow text="No rows. Add dine-in / parcel splits." />
                ) : (
                  <div className="space-y-2">
                    <RowHeader
                      cols={['Type', 'Bills', 'Revenue', '']}
                      template="2fr 1fr 1fr 2.5rem"
                    />
                    {(form.byOrderType || []).map((row, i) => (
                      <div
                        key={i}
                        className="grid items-center gap-2"
                        style={{ gridTemplateColumns: '2fr 1fr 1fr 2.5rem' }}
                      >
                        <Select
                          value={row.type}
                          onChange={(e) =>
                            patchList('byOrderType', (arr) =>
                              arr.map((r, j) =>
                                j === i ? { ...r, type: e.target.value } : r,
                              ),
                            )
                          }
                        >
                          {ORDER_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                        <NumberInput
                          value={row.count}
                          onChange={(e) =>
                            patchList('byOrderType', (arr) =>
                              arr.map((r, j) =>
                                j === i ? { ...r, count: e.target.value } : r,
                              ),
                            )
                          }
                          min="0"
                          step="1"
                        />
                        <NumberInput
                          value={row.total}
                          onChange={(e) =>
                            patchList('byOrderType', (arr) =>
                              arr.map((r, j) =>
                                j === i ? { ...r, total: e.target.value } : r,
                              ),
                            )
                          }
                          step="0.01"
                        />
                        <RemoveButton
                          onClick={() =>
                            patchList('byOrderType', (arr) =>
                              arr.filter((_, j) => j !== i),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </FormSection>

              {/* Top items */}
              <FormSection
                icon={TrendingUp}
                title="Top items"
                action={
                  <AddRowButton
                    onClick={() =>
                      patchList('topItems', (arr) => [
                        ...arr,
                        { name: '', quantity: 0, revenue: 0 },
                      ])
                    }
                  />
                }
              >
                {(form.topItems || []).length === 0 ? (
                  <EmptyRow text="No rows. Add items to feature in the daily report." />
                ) : (
                  <div className="space-y-2">
                    <RowHeader
                      cols={['Item name', 'Qty sold', 'Revenue', '']}
                      template="3fr 1fr 1fr 2.5rem"
                    />
                    {(form.topItems || []).map((row, i) => (
                      <div
                        key={i}
                        className="grid items-center gap-2"
                        style={{ gridTemplateColumns: '3fr 1fr 1fr 2.5rem' }}
                      >
                        <TextInput
                          value={row.name}
                          placeholder="e.g. Chicken Biryani (Full)"
                          onChange={(e) =>
                            patchList('topItems', (arr) =>
                              arr.map((r, j) =>
                                j === i ? { ...r, name: e.target.value } : r,
                              ),
                            )
                          }
                        />
                        <NumberInput
                          value={row.quantity}
                          onChange={(e) =>
                            patchList('topItems', (arr) =>
                              arr.map((r, j) =>
                                j === i
                                  ? { ...r, quantity: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          min="0"
                          step="1"
                        />
                        <NumberInput
                          value={row.revenue}
                          onChange={(e) =>
                            patchList('topItems', (arr) =>
                              arr.map((r, j) =>
                                j === i
                                  ? { ...r, revenue: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          step="0.01"
                        />
                        <RemoveButton
                          onClick={() =>
                            patchList('topItems', (arr) =>
                              arr.filter((_, j) => j !== i),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </FormSection>

              {/* Notes + Lock */}
              <FormSection title="Notes & lock">
                <Field
                  label="Notes"
                  hint="Why the adjustment? Visible on the admin Reports page."
                >
                  <TextInput
                    value={form.notes}
                    onChange={(e) => patchField('notes', e.target.value)}
                    placeholder="e.g. deposit refund, cash tips excluded"
                  />
                </Field>
                <div className="mt-4">
                  <Field label="Lock">
                    <Toggle
                      checked={!!form.locked}
                      onChange={(v) => patchField('locked', v)}
                      label={
                        form.locked
                          ? 'Locked — auto-recompute will skip this report'
                          : 'Unlocked — auto-recompute can overwrite these values'
                      }
                    />
                  </Field>
                </div>
              </FormSection>

              {/* Action bar */}
              <div className="sticky bottom-0 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-navy-950/95 backdrop-blur border-t border-white/5 flex flex-wrap items-center gap-2">
                <Button
                  variant="blue"
                  size="lg"
                  icon={Save}
                  loading={save.isPending}
                  disabled={!dirty}
                  onClick={handleSave}
                >
                  Save changes
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  icon={RefreshCcw}
                  loading={regenerate.isPending}
                  onClick={handleRegenerate}
                >
                  Regenerate from bills
                </Button>
                <div className="flex-1" />
                {raw?.generatedAt && (
                  <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <History size={12} /> Updated {formatDate(raw.generatedAt)}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ── small UI helpers ────────────────────────────────────────────────

function FormSection({ icon: Icon, title, action, children }) {
  return (
    <section className="pos-panel p-4 md:p-5">
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="h-8 w-8 rounded-lg bg-panel-800 text-brand-500 flex items-center justify-center">
              <Icon size={16} />
            </div>
          )}
          <h3 className="text-white font-bold text-sm md:text-base">{title}</h3>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Explainer() {
  return (
    <div className="rounded-xl bg-panel-900 border border-white/5 px-4 py-3 text-xs text-slate-300 flex items-start gap-2">
      <ShieldAlert size={16} className="text-flame-400 shrink-0 mt-0.5" />
      <div>
        Every field below maps to a value shown on the frontend reports.
        Saving any change <b>locks</b> this report so auto-recompute
        won't overwrite it. <b>Regenerate from bills</b> discards your edits
        and pulls the live totals from the Bills collection.
      </div>
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

// ── form helpers ────────────────────────────────────────────────────

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function defaults(raw) {
  return {
    revenue: raw?.revenue ?? 0,
    subtotal: raw?.subtotal ?? 0,
    tax: raw?.tax ?? 0,
    discount: raw?.discount ?? 0,
    serviceCharge: raw?.serviceCharge ?? 0,
    billsPaid: raw?.billsPaid ?? 0,
    kotsCount: raw?.kotsCount ?? 0,
    ordersCount: raw?.ordersCount ?? 0,
    byPaymentMethod: (raw?.byPaymentMethod || []).map((p) => ({
      method: p.method || 'CASH',
      amount: p.amount ?? 0,
      count: p.count ?? 0,
    })),
    byOrderType: (raw?.byOrderType || []).map((t) => ({
      type: t.type || 'DINING',
      count: t.count ?? 0,
      total: t.total ?? 0,
    })),
    topItems: (raw?.topItems || []).map((i) => ({
      menuItem: i.menuItem || null,
      name: i.name || '',
      quantity: i.quantity ?? 0,
      revenue: i.revenue ?? 0,
    })),
    notes: raw?.notes || '',
    locked: !!raw?.locked,
  };
}
