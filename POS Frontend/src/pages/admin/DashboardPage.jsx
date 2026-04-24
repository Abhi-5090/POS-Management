import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Wallet,
  Receipt,
  Users,
  UtensilsCrossed,
  LayoutGrid,
  ClipboardList,
  TrendingUp,
  Printer,
  ChefHat,
  Clock,
  ChevronRight,
} from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import StatCard from '../../components/admin/StatCard';
import DataTable from '../../components/admin/DataTable';
import Button from '../../components/Button';
import { reportsApi } from '../../api/reports';
import { money, formatDate, shortId } from '../../utils/format';
import { on } from '../../services/socket';

export default function DashboardPage() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: reportsApi.dashboard,
    refetchInterval: 30_000,
  });

  // Live refresh on any sales/order event so the dashboard never feels stale.
  useEffect(() => {
    const offs = [
      on('bill_settled', () => qc.invalidateQueries({ queryKey: ['admin-dashboard'] })),
      on('bill_generated', () => qc.invalidateQueries({ queryKey: ['admin-dashboard'] })),
      on('new_kot', () => qc.invalidateQueries({ queryKey: ['admin-dashboard'] })),
      on('session_opened', () => qc.invalidateQueries({ queryKey: ['admin-dashboard'] })),
      on('session_closed', () => qc.invalidateQueries({ queryKey: ['admin-dashboard'] })),
    ];
    return () => offs.forEach((off) => off && off());
  }, [qc]);

  const k = data?.kpis || {};
  const tables = k.tables || { free: 0, occupied: 0, total: 0 };
  const occupancy = tables.total
    ? Math.round((tables.occupied / tables.total) * 100)
    : 0;
  const avgBill = k.bills ? k.revenue / k.bills : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Today · ${new Date().toLocaleDateString()}`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="Revenue today"
          value={money(k.revenue || 0)}
          sub={`${k.bills || 0} bills · avg ${money(avgBill || 0)}`}
          tone="green"
          loading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Tax collected"
          value={money(k.tax || 0)}
          sub={`Discounts ${money(k.discount || 0)}`}
          tone="blue"
          loading={isLoading}
        />
        <StatCard
          icon={LayoutGrid}
          label="Occupancy"
          value={`${occupancy}%`}
          sub={`${tables.occupied}/${tables.total} tables in use`}
          tone="orange"
          loading={isLoading}
        />
        <StatCard
          icon={ClipboardList}
          label="Open orders"
          value={k.openOrders ?? 0}
          sub={`${k.activeSessions ?? 0} active sessions`}
          tone="slate"
          loading={isLoading}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={UtensilsCrossed}
          label="Menu items"
          value={k.menuItems ?? 0}
          sub="Active"
          tone="slate"
          loading={isLoading}
        />
        <StatCard
          icon={Users}
          label="Staff"
          value={k.staff ?? 0}
          sub="Active"
          tone="slate"
          loading={isLoading}
        />
        <StatCard
          icon={Receipt}
          label="Gross subtotal"
          value={money(k.subtotal || 0)}
          sub="Before tax + discount"
          tone="slate"
          loading={isLoading}
        />
        <StatCard
          icon={ChefHat}
          label="KOTs today"
          value={data?.recentKots?.length ? `${(data.recentKots || []).length}+` : '0'}
          sub="Recent tickets below"
          tone="slate"
          loading={isLoading}
        />
      </div>

      {/* Two-column: payments + top items */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="pos-panel p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold">Revenue by payment method</h3>
            <span className="text-xs text-slate-400">Today</span>
          </div>
          {(data?.payments || []).length === 0 ? (
            <div className="text-slate-400 text-sm py-6">No payments yet.</div>
          ) : (
            <ul className="space-y-3">
              {data.payments.map((p) => {
                const pct = k.revenue
                  ? Math.min(100, Math.round((p.amount / k.revenue) * 100))
                  : 0;
                return (
                  <li key={p.method}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-200 font-semibold">
                        {p.method} <span className="text-slate-500">· {p.count}</span>
                      </span>
                      <span className="text-white font-bold tabular-nums">
                        {money(p.amount)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-panel-800 overflow-hidden">
                      <div
                        className="h-full bg-brand-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="pos-panel p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold">Top selling items</h3>
            <span className="text-xs text-slate-400">Today</span>
          </div>
          {(data?.topItems || []).length === 0 ? (
            <div className="text-slate-400 text-sm py-6">Nothing sold yet.</div>
          ) : (
            <ul className="space-y-2">
              {data.topItems.map((t, idx) => {
                const topQty = data.topItems[0].quantity || 1;
                const pct = Math.round((t.quantity / topQty) * 100);
                return (
                  <li key={t.menuItem || idx} className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-md bg-panel-800 text-slate-300 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-100 font-semibold truncate">
                          {t.name}
                        </span>
                        <span className="text-slate-300 tabular-nums shrink-0 ml-3">
                          × {t.quantity} ·{' '}
                          <span className="text-white font-bold">
                            {money(t.revenue)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 mt-1 rounded-full bg-panel-800 overflow-hidden">
                        <div
                          className="h-full bg-flame-500"
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
      </div>

      {/* Recent bills */}
      <section className="pos-panel p-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold">Recent bills</h3>
          <Link
            to="/admin/bills"
            className="text-xs text-brand-500 hover:text-brand-100 font-semibold inline-flex items-center gap-1"
          >
            View all <ChevronRight size={14} />
          </Link>
        </div>
        <DataTable
          loading={isLoading}
          rows={data?.recentBills || []}
          emptyTitle="No bills yet"
          columns={[
            {
              key: 'billNumber',
              label: 'Bill',
              render: (r) => (
                <span className="font-semibold text-white">{r.billNumber}</span>
              ),
            },
            {
              key: 'type',
              label: 'Type',
              render: (r) => (
                <span className="pos-chip bg-panel-800 text-slate-200 border border-white/5">
                  {r.orderType}
                </span>
              ),
            },
            {
              key: 'table',
              label: 'Table',
              render: (r) => r.tableNumber || '—',
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusChip status={r.status} />,
            },
            {
              key: 'total',
              label: 'Total',
              align: 'right',
              render: (r) => money(r.total),
            },
            {
              key: 'createdAt',
              label: 'When',
              render: (r) => (
                <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
                  <Clock size={11} /> {formatDate(r.createdAt)}
                </span>
              ),
            },
          ]}
        />
      </section>

      {/* Recent KOTs */}
      <section className="pos-panel p-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold">Recent KOTs</h3>
          <Link
            to="/kitchen"
            className="text-xs text-brand-500 hover:text-brand-100 font-semibold inline-flex items-center gap-1"
          >
            Kitchen Display <ChevronRight size={14} />
          </Link>
        </div>
        <DataTable
          loading={isLoading}
          rows={data?.recentKots || []}
          emptyTitle="No tickets today"
          columns={[
            {
              key: 'kotNumber',
              label: 'KOT',
              render: (r) => (
                <span className="font-semibold text-white">{r.kotNumber}</span>
              ),
            },
            {
              key: 'orderType',
              label: 'Type',
              render: (r) => (
                <span className="pos-chip bg-panel-800 text-slate-200 border border-white/5">
                  {r.orderType}
                </span>
              ),
            },
            {
              key: 'table',
              label: 'Table',
              render: (r) => r.tableNumber || '—',
            },
            {
              key: 'batch',
              label: 'Batch',
              render: (r) => `#${r.batchNumber}`,
            },
            {
              key: 'items',
              label: 'Items',
              align: 'right',
              render: (r) => (r.items || []).length,
            },
            {
              key: 'print',
              label: 'Print',
              render: (r) => (
                <span
                  className={`pos-chip ${
                    r.printStatus === 'PRINTED'
                      ? 'bg-leaf-500/15 text-leaf-500'
                      : r.printStatus === 'FAILED'
                      ? 'bg-ember-500/15 text-ember-500'
                      : 'bg-amber-500/15 text-amber-400'
                  }`}
                >
                  <Printer size={11} className="mr-1" />
                  {r.printStatus}
                </span>
              ),
            },
            {
              key: 'createdAt',
              label: 'When',
              render: (r) => (
                <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
                  <Clock size={11} /> {formatDate(r.createdAt)}
                </span>
              ),
            },
          ]}
        />
      </section>
    </>
  );
}

function StatusChip({ status }) {
  const cls =
    status === 'PAID'
      ? 'bg-leaf-500/15 text-leaf-500'
      : status === 'OPEN'
      ? 'bg-amber-500/15 text-amber-400'
      : status === 'CANCELLED'
      ? 'bg-ember-500/15 text-ember-500'
      : 'bg-slate-500/15 text-slate-300';
  return <span className={`pos-chip ${cls}`}>{status}</span>;
}
