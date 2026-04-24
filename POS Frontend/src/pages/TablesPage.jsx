import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RefreshCcw, Home, TreePalm, LayoutGrid } from 'lucide-react';
import Header from '../components/Header';
import ConnectionBanner from '../components/ConnectionBanner';
import TableCard from '../components/TableCard';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import { tablesApi } from '../api/tables';
import { useDraftOrderStore } from '../store/draftOrderStore';
import { on } from '../services/socket';

/**
 *  Tables page (single-view)
 *  -------------------------
 *  Every active table on one scrollable page — no floor switcher.
 *  Tables are sorted section → number so Indoor tables still visually
 *  cluster together, but the cashier sees the whole floor plan at a
 *  glance.
 *
 *  KEY WORKFLOW RULE (tap behaviour):
 *    - Occupied table → jump straight to its existing order.
 *    - Free / reserved table → navigate to the LOCAL draft page; the
 *      table only becomes Occupied on the first "Send to Kitchen".
 */
export default function TablesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: tables = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['tables'],
    queryFn: tablesApi.list,
    refetchOnMount: 'always',
  });

  const drafts = useDraftOrderStore((s) => s.drafts);

  // Realtime: refetch on every table-lifecycle event so the grid
  // accurately reflects occupancy across devices.
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: ['tables'] });
    const offs = [
      on('session_opened', refresh),
      on('session_closed', refresh),
      on('session_reopened', refresh),
      on('bill_settled', refresh),
      on('bill_generated', refresh),
      on('order_updated', refresh),
    ];
    return () => offs.forEach((off) => off && off());
  }, [qc]);

  /**
   * Group by section, preserving a deterministic order:
   *   1. Indoor first (if present)
   *   2. Outdoor second
   *   3. Everything else, alphabetically
   * Within each group, tables are sorted numerically by number.
   */
  const sections = useMemo(() => {
    const map = new Map();
    for (const t of tables) {
      const key = (t.section || 'Main').trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    const entries = Array.from(map.entries());
    const priority = (name) => {
      const n = name.toLowerCase();
      if (n === 'indoor') return 0;
      if (n === 'outdoor') return 1;
      return 2;
    };
    entries.sort(([a], [b]) => {
      const pa = priority(a);
      const pb = priority(b);
      return pa !== pb ? pa - pb : a.localeCompare(b);
    });
    return entries.map(([name, items]) => ({
      name,
      items: items.slice().sort((a, b) =>
        String(a.number).localeCompare(String(b.number), undefined, { numeric: true }),
      ),
    }));
  }, [tables]);

  const counts = useMemo(() => {
    let occupied = 0;
    let free = 0;
    let reserved = 0;
    for (const t of tables) {
      if (t.status === 'occupied') occupied += 1;
      else if (t.status === 'reserved') reserved += 1;
      else free += 1;
    }
    return { occupied, free, reserved, total: tables.length };
  }, [tables]);

  // Cashier has opted into split mode for these table ids (pre-commit).
  // Once any seat commits, the backend reports activeSessions with
  // seat labels and the card stays split on its own.
  const [splitRequested, setSplitRequested] = useState(new Set());

  const toggleSplitRequest = (table) => {
    setSplitRequested((prev) => {
      const next = new Set(prev);
      if (next.has(table._id)) next.delete(table._id);
      else next.add(table._id);
      return next;
    });
  };

  // Collapse a requested split back to whole-table view. Only meaningful
  // when no seat has actually committed a session — in that case the
  // split is purely a UI intent we can cancel freely.
  const cancelSplitRequest = (table) => {
    setSplitRequested((prev) => {
      if (!prev.has(table._id)) return prev;
      const next = new Set(prev);
      next.delete(table._id);
      return next;
    });
  };

  /**
   * Tap semantics:
   *   - Whole-table free  → go to whole-table draft.
   *   - Whole-table busy  → go to the existing order.
   *   - Split seat free   → go to that seat's draft.
   *   - Split seat busy   → go to that seat's order.
   */
  const handleTableTap = (table, { seatLabel = null } = {}) => {
    if (!table.isActive) {
      toast.error('This table is inactive.');
      return;
    }

    const sessions = table.activeSessions || [];
    const match = sessions.find((s) => (s.seatLabel || null) === seatLabel);

    if (match) {
      const orderId = match.order?._id || match.order;
      if (orderId) {
        navigate(`/order/${orderId}`, { state: { tableNumber: table.number } });
      } else {
        toast('That session has no active order.', { icon: '⚠️' });
      }
      return;
    }

    // No session for this (table, seat) — go to the appropriate draft.
    const url = seatLabel
      ? `/order/new/${table._id}/seat/${seatLabel}`
      : `/order/new/${table._id}`;
    navigate(url, { state: { tableNumber: table.number, seatLabel } });
  };

  return (
    <div className="h-screen w-full bg-navy-grad flex flex-col">
      <ConnectionBanner />
      <Header
        title="Table Management"
        subtitle={`${counts.total} tables · ${counts.free} available · ${counts.occupied} occupied${counts.reserved ? ` · ${counts.reserved} reserved` : ''}`}
        onBack={() => navigate('/')}
        right={
          <>
            <Legend />
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCcw}
              onClick={() => refetch()}
              loading={isFetching}
            >
              <span className="hidden md:inline">Refresh</span>
            </Button>
          </>
        }
      />

      <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-6">
        {isLoading ? (
          <Loader label="Loading tables…" />
        ) : tables.length === 0 ? (
          <EmptyState
            title="No tables configured"
            description="Add tables from Admin → Tables."
          />
        ) : (
          sections.map((section) => (
            <SectionBlock
              key={section.name}
              name={section.name}
              items={section.items}
              drafts={drafts}
              splitRequested={splitRequested}
              onTap={handleTableTap}
              onSplit={toggleSplitRequest}
              onUnsplit={cancelSplitRequest}
            />
          ))
        )}
      </main>
    </div>
  );
}

function SectionBlock({ name, items, drafts, splitRequested, onTap, onSplit, onUnsplit }) {
  const occupied = items.filter((t) => t.status === 'occupied').length;
  const total = items.length;
  const lower = name.toLowerCase();
  const Icon = lower === 'outdoor' ? TreePalm : lower === 'indoor' ? Home : LayoutGrid;
  const accent =
    lower === 'outdoor'
      ? 'text-flame-400 bg-flame-500/10 border-flame-500/20'
      : lower === 'indoor'
      ? 'text-brand-100 bg-brand-500/10 border-brand-500/20'
      : 'text-slate-300 bg-panel-800 border-white/10';

  return (
    <section className="pos-panel p-4 md:p-5">
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${accent}`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-white font-extrabold text-lg truncate">{name}</h2>
            <div className="text-xs text-slate-400 font-semibold">
              {total} table{total === 1 ? '' : 's'} · {occupied} occupied
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
        {items.map((t) => {
          // Sum draft counts across all seats of this table.
          const prefix = `${t._id}:`;
          let draftCount = 0;
          for (const [k, list] of Object.entries(drafts)) {
            if (k.startsWith(prefix)) draftCount += (list || []).length;
          }
          return (
            <TableCard
              key={t._id}
              table={t}
              draftCount={draftCount}
              splitRequested={splitRequested.has(t._id)}
              onClick={onTap}
              onSplit={onSplit}
              onUnsplit={onUnsplit}
            />
          );
        })}
      </div>
    </section>
  );
}

/** Small color-key strip so first-time users can read the grid at a glance. */
function Legend() {
  return (
    <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-panel-800 border border-white/10 text-xs">
      <LegendDot color="bg-leaf-500" label="Available" />
      <LegendDot color="bg-ember-500" label="Occupied" />
      <LegendDot color="bg-amber-400" label="Reserved" />
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-300 font-semibold">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
