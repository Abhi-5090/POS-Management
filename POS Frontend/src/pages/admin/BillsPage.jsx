import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Receipt,
  Printer,
  Ban,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Pencil,
} from 'lucide-react';
import clsx from 'clsx';

import PageHeader from '../../components/admin/PageHeader';
import Button from '../../components/Button';
import DataTable from '../../components/admin/DataTable';
import Modal from '../../components/Modal';
import EditBillModal from '../../components/admin/EditBillModal';
import { Field, Select } from '../../components/admin/FormField';
import { useAuthStore } from '../../store/authStore';

import { billsApi } from '../../api/bills';
import { money, formatDate } from '../../utils/format';

const STATUSES = ['', 'OPEN', 'PAID', 'CANCELLED', 'REFUNDED'];
const TYPES = ['', 'DINING', 'PARCEL'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function BillsPage() {
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    status: '',
    orderType: '',
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bills', filters, page, limit],
    queryFn: () =>
      billsApi.list({
        ...filters,
        ...(filters.from ? { from: `${filters.from}T00:00:00` } : {}),
        ...(filters.to ? { to: `${filters.to}T23:59:59` } : {}),
        page,
        limit,
      }),
    keepPreviousData: true,
  });

  const bills = data?.data || [];
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  const filtered = useMemo(() => {
    if (!search) return bills;
    const s = search.toLowerCase();
    return bills.filter(
      (b) =>
        (b.billNumber || '').toLowerCase().includes(s) ||
        (b.invoiceNumber || '').toLowerCase().includes(s) ||
        (b.tableNumber || '').toLowerCase().includes(s) ||
        (b.customer?.name || '').toLowerCase().includes(s) ||
        (b.customer?.phone || '').toLowerCase().includes(s),
    );
  }, [bills, search]);

  const paidRevenue = bills
    .filter((b) => b.status === 'PAID')
    .reduce((s, b) => s + (b.total || 0), 0);

  const reprint = useMutation({
    mutationFn: (id) => billsApi.reprint(id),
    onSuccess: () => toast.success('Reprint queued'),
    onError: (e) => toast.error(e.message || 'Reprint failed'),
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }) => billsApi.cancel(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bills'] });
      toast.success('Bill cancelled');
      setDetail(null);
    },
    onError: (e) => toast.error(e.message || 'Cancel failed'),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }) => billsApi.update(id, patch),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['admin-bills'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      qc.invalidateQueries({ queryKey: ['admin-daily-sales'] });
      toast.success(`Bill ${saved.billNumber} updated`);
      setEditing(null);
      // Refresh the detail modal if it's still pointing at this bill.
      setDetail((prev) => (prev && prev._id === saved._id ? saved : prev));
    },
    onError: (e) => toast.error(e.message || 'Save failed'),
  });

  return (
    <>
      <PageHeader
        title="Bills"
        subtitle={`${total} bill${total === 1 ? '' : 's'} match · ${money(paidRevenue)} paid on this page`}
      />

      <section className="pos-panel p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From" className="w-44">
            <div className="relative">
              <Calendar
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="date"
                value={filters.from}
                onChange={(e) => {
                  setFilters({ ...filters, from: e.target.value });
                  setPage(1);
                }}
                className="input-dark pl-9"
              />
            </div>
          </Field>
          <Field label="To" className="w-44">
            <div className="relative">
              <Calendar
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="date"
                value={filters.to}
                onChange={(e) => {
                  setFilters({ ...filters, to: e.target.value });
                  setPage(1);
                }}
                className="input-dark pl-9"
              />
            </div>
          </Field>
          <Field label="Status" className="w-40">
            <Select
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPage(1);
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s || 'All'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" className="w-40">
            <Select
              value={filters.orderType}
              onChange={(e) => {
                setFilters({ ...filters, orderType: e.target.value });
                setPage(1);
              }}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t || 'All'}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex-1" />
          <div className="relative w-64">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bill / table / customer…"
              className="input-dark pl-9"
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon={Filter}
            onClick={() => {
              setFilters({ from: '', to: '', status: '', orderType: '' });
              setSearch('');
              setPage(1);
            }}
          >
            Reset
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFilters({
                from: todayISO(),
                to: todayISO(),
                status: '',
                orderType: '',
              });
              setPage(1);
            }}
          >
            Today
          </Button>
        </div>
      </section>

      <div className="pos-panel p-5">
        <DataTable
          loading={isLoading}
          rows={filtered}
          emptyTitle="No bills found"
          emptyDescription="Adjust your filters or widen the date range."
          onRowClick={(b) => setDetail(b)}
          columns={[
            {
              key: 'billNumber',
              label: 'Bill',
              render: (r) => (
                <div>
                  <div className="text-white font-semibold">{r.billNumber}</div>
                  <div className="text-[11px] text-slate-400">{r.invoiceNumber}</div>
                </div>
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
            { key: 'table', label: 'Table', render: (r) => r.tableNumber || '—' },
            {
              key: 'customer',
              label: 'Customer',
              render: (r) => r.customer?.name || '—',
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
              render: (r) => (
                <span className="text-white font-bold">{money(r.total)}</span>
              ),
            },
            {
              key: 'paid',
              label: 'Paid',
              align: 'right',
              render: (r) => money(r.paidAmount || 0),
            },
            {
              key: 'createdAt',
              label: 'When',
              render: (r) => (
                <span className="text-xs text-slate-400">
                  {formatDate(r.createdAt)}
                </span>
              ),
            },
          ]}
        />

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Page {page} of {pages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-9 w-9 rounded-lg bg-panel-800 hover:bg-panel-700 disabled:opacity-40 text-slate-200 flex items-center justify-center"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="h-9 w-9 rounded-lg bg-panel-800 hover:bg-panel-700 disabled:opacity-40 text-slate-200 flex items-center justify-center"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <BillDetailModal
        bill={detail}
        isAdmin={isAdmin}
        onClose={() => setDetail(null)}
        onReprint={(id) => reprint.mutate(id)}
        onCancel={(id) => {
          const reason = window.prompt('Cancellation reason?');
          if (reason !== null) cancel.mutate({ id, reason });
        }}
        onEdit={(b) => {
          setDetail(null);
          setEditing(b);
        }}
      />

      <EditBillModal
        open={!!editing}
        bill={editing}
        saving={update.isPending}
        onClose={() => setEditing(null)}
        onSave={(patch) => update.mutate({ id: editing._id, patch })}
      />
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
  return <span className={clsx('pos-chip', cls)}>{status}</span>;
}

function BillDetailModal({ bill, isAdmin, onClose, onReprint, onCancel, onEdit }) {
  if (!bill) return null;
  return (
    <Modal
      open={!!bill}
      onClose={onClose}
      title={`Bill ${bill.billNumber}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" icon={Printer} onClick={() => onReprint(bill._id)}>
            Reprint
          </Button>
          {isAdmin && (
            <Button variant="blue" icon={Pencil} onClick={() => onEdit?.(bill)}>
              Edit
            </Button>
          )}
          {bill.status !== 'PAID' && bill.status !== 'CANCELLED' && (
            <Button variant="red" icon={Ban} onClick={() => onCancel(bill._id)}>
              Cancel bill
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <Info label="Invoice #" value={bill.invoiceNumber} />
        <Info label="Status" value={<StatusChip status={bill.status} />} />
        <Info label="Type" value={bill.orderType} />
        <Info label="Table" value={bill.tableNumber || '—'} />
        <Info label="Customer" value={bill.customer?.name || '—'} />
        <Info label="Phone" value={bill.customer?.phone || '—'} />
        <Info label="Created" value={formatDate(bill.createdAt)} />
        <Info label="Paid at" value={bill.paidAt ? formatDate(bill.paidAt) : '—'} />
      </div>

      <div className="rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel-900 text-slate-400 uppercase text-[11px]">
              <th className="text-left px-4 py-2">Item</th>
              <th className="text-right px-4 py-2">Qty</th>
              <th className="text-right px-4 py-2">Rate</th>
              <th className="text-right px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {(bill.items || []).map((it, i) => (
              <tr key={i} className="bg-panel-800/60">
                <td className="px-4 py-2 text-slate-100">{it.name}</td>
                <td className="px-4 py-2 text-right text-slate-200">{it.quantity}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(it.price)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-white font-semibold">
                  {money(it.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1.5">
          <Row label="Subtotal" value={money(bill.subtotal)} />
          {!!bill.discount && <Row label="Discount" value={`- ${money(bill.discount)}`} tone="green" />}
          {!!bill.serviceCharge && <Row label="Service" value={money(bill.serviceCharge)} />}
          {!!bill.taxAmount && (
            <>
              <Row label="CGST" value={money(bill.cgst)} />
              <Row label="SGST" value={money(bill.sgst)} />
            </>
          )}
          {!!bill.roundingAdjustment && (
            <Row label="Round off" value={money(bill.roundingAdjustment)} />
          )}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-white font-bold">Total</span>
            <span className="text-white font-extrabold text-lg tabular-nums">
              {money(bill.total)}
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">
            Payments
          </div>
          {(bill.payments || []).length === 0 ? (
            <div className="text-slate-400 text-sm">No payment recorded.</div>
          ) : (
            <ul className="space-y-1.5">
              {bill.payments.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between bg-panel-900 rounded-lg px-3 py-2 border border-white/5"
                >
                  <span className="text-slate-200 font-semibold">
                    {p.method}
                    {p.reference && (
                      <span className="text-xs text-slate-400 ml-2">
                        · {p.reference}
                      </span>
                    )}
                  </span>
                  <span className="text-white font-bold tabular-nums">
                    {money(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {bill.balanceDue > 0 && (
            <div className="mt-2 text-ember-500 font-semibold text-sm">
              Balance due: {money(bill.balanceDue)}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">
        {label}
      </div>
      <div className="text-slate-100 mt-0.5">{value}</div>
    </div>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span
        className={clsx(
          'tabular-nums font-semibold',
          tone === 'green' ? 'text-leaf-500' : 'text-slate-100',
        )}
      >
        {value}
      </span>
    </div>
  );
}
