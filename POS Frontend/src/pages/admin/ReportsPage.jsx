import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet,
  Receipt,
  TrendingDown,
  Calendar,
  ChefHat,
  Utensils,
} from 'lucide-react';
import clsx from 'clsx';

import PageHeader from '../../components/admin/PageHeader';
import StatCard from '../../components/admin/StatCard';
import Button from '../../components/Button';
import Loader from '../../components/Loader';

import { reportsApi } from '../../api/reports';
import { money } from '../../utils/format';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 *  Admin Reports — VIEW ONLY.
 *  --------------------------
 *  The admin panel shows the day's KPIs + breakdowns read from the
 *  DailyReport collection. It no longer exposes Edit / Regenerate
 *  controls — that lives on the standalone Edit Reports page under
 *  /reports/edit.
 *
 *  The lock banner still reflects whether this day's numbers are the
 *  live auto-computed values or an admin override, so viewers know
 *  they might be looking at an adjusted report.
 */
export default function ReportsPage() {
  const [date, setDate] = useState(todayISO());

  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['admin-daily-sales', date],
    queryFn: () => reportsApi.dailySales(date),
  });
  const { data: kitchen } = useQuery({
    queryKey: ['admin-kitchen-activity', date],
    queryFn: () => reportsApi.kitchenActivity(date),
  });

  const summary = sales?.summary || {};
  const payments = sales?.byPaymentMethod || [];
  const types = sales?.byOrderType || [];
  const top = sales?.topItems || [];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Daily sales & kitchen activity · read-only view of the DailyReport collection"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-dark pl-9 h-10 text-sm"
                max={todayISO()}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDate(todayISO())}>
              Today
            </Button>
          </div>
        }
      />

      {salesLoading ? (
        <Loader label="Crunching numbers…" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Wallet}
              label="Revenue"
              value={money(summary.revenue || 0)}
              sub={`${summary.billsPaid || 0} bills`}
              tone="green"
            />
            <StatCard
              icon={Receipt}
              label="Tax collected"
              value={money(summary.tax || 0)}
              sub={`Subtotal ${money(summary.subtotal || 0)}`}
              tone="blue"
            />
            <StatCard
              icon={TrendingDown}
              label="Discounts"
              value={money(summary.discount || 0)}
              sub="Applied this day"
              tone="orange"
            />
            <StatCard
              icon={Utensils}
              label="Avg bill"
              value={money(
                summary.billsPaid ? (summary.revenue || 0) / summary.billsPaid : 0,
              )}
              sub="Across paid bills"
              tone="slate"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
            <section className="pos-panel p-5">
              <h3 className="text-white font-bold mb-3">By payment method</h3>
              {payments.length === 0 ? (
                <div className="text-slate-400 text-sm py-4">No payments.</div>
              ) : (
                <BarList
                  items={payments.map((p) => ({
                    label: p.method,
                    value: p.amount,
                    meta: `${p.count} txn`,
                  }))}
                  max={Math.max(...payments.map((p) => p.amount))}
                  color="bg-brand-500"
                />
              )}
            </section>

            <section className="pos-panel p-5">
              <h3 className="text-white font-bold mb-3">By order type</h3>
              {types.length === 0 ? (
                <div className="text-slate-400 text-sm py-4">No orders.</div>
              ) : (
                <BarList
                  items={types.map((t) => ({
                    label: t.type,
                    value: t.total,
                    meta: `${t.count} bills`,
                  }))}
                  max={Math.max(...types.map((t) => t.total))}
                  color="bg-flame-500"
                />
              )}
            </section>
          </div>

          <section className="pos-panel p-5 mt-6">
            <h3 className="text-white font-bold mb-3">Top items</h3>
            {top.length === 0 ? (
              <div className="text-slate-400 text-sm py-4">Nothing sold.</div>
            ) : (
              <ul className="divide-y divide-white/5">
                {top.map((t, idx) => {
                  const topQty = top[0].quantity || 1;
                  const pct = Math.round((t.quantity / topQty) * 100);
                  return (
                    <li
                      key={t.menuItem || idx}
                      className="py-2.5 flex items-center gap-4"
                    >
                      <div className="h-8 w-8 rounded-lg bg-panel-800 text-slate-200 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-white font-semibold truncate">
                            {t.name}
                          </div>
                          <div className="text-slate-300 ml-3 tabular-nums shrink-0">
                            × {t.quantity} ·{' '}
                            <span className="text-white font-bold">
                              {money(t.revenue)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 mt-1 rounded-full bg-panel-800 overflow-hidden">
                          <div
                            className="h-full bg-leaf-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="pos-panel p-5 mt-6">
            <div className="flex items-center gap-2 mb-3">
              <ChefHat size={16} className="text-flame-400" />
              <h3 className="text-white font-bold">Kitchen activity</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase mb-2">
                  KOTs
                </div>
                {(kitchen?.kots || []).length === 0 ? (
                  <div className="text-slate-400 text-sm">No tickets.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {kitchen.kots.map((k) => (
                      <li
                        key={k._id}
                        className="flex items-center justify-between bg-panel-900 border border-white/5 rounded-lg px-3 py-2"
                      >
                        <span className="text-slate-200 font-semibold">
                          {k._id}
                        </span>
                        <span className="text-slate-300 text-sm tabular-nums">
                          {k.count} tickets · {k.items} items
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase mb-2">
                  Orders placed
                </div>
                {(kitchen?.orders || []).length === 0 ? (
                  <div className="text-slate-400 text-sm">No orders.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {kitchen.orders.map((o) => (
                      <li
                        key={o._id}
                        className="flex items-center justify-between bg-panel-900 border border-white/5 rounded-lg px-3 py-2"
                      >
                        <span className="text-slate-200 font-semibold">
                          {o._id}
                        </span>
                        <span className="text-slate-300 text-sm tabular-nums">
                          {o.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function BarList({ items, max, color }) {
  return (
    <ul className="space-y-3">
      {items.map((it) => {
        const pct = max ? Math.round((it.value / max) * 100) : 0;
        return (
          <li key={it.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-200 font-semibold">
                {it.label}
                {it.meta && <span className="text-slate-500 ml-2">{it.meta}</span>}
              </span>
              <span className="text-white font-bold tabular-nums">
                {money(it.value)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-panel-800 overflow-hidden">
              <div className={clsx('h-full', color)} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
