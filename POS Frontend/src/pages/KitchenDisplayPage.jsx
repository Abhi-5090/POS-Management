import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Bell, Printer, Clock, ChefHat, CheckCircle2, Trash2 } from 'lucide-react';
import clsx from 'clsx';

import Header from '../components/Header';
import ConnectionBanner from '../components/ConnectionBanner';
import EmptyState from '../components/EmptyState';

import { kotsApi } from '../api/kots';
import { ordersApi } from '../api/orders';
import { on, emit } from '../services/socket';
import { ORDER_ITEM_STATUS } from '../utils/constants';
import { formatDate } from '../utils/format';

/**
 *  Kitchen Display
 *  ---------------
 *  Live stream of KOTs. New ones animate in, ADDITIONAL runs are
 *  flagged orange. Each item has a "Mark Ready" pill — tapping it
 *  flips the order item's status so the counter + waiters see it.
 *
 *  Audio + toast announces every new KOT.
 */
export default function KitchenDisplayPage() {
  const { data: initial = [], refetch } = useQuery({
    queryKey: ['kots-today'],
    queryFn: kotsApi.today,
    refetchOnMount: 'always',
  });

  const [kots, setKots] = useState([]);

  useEffect(() => {
    if (initial.length) setKots(initial);
  }, [initial]);

  useEffect(() => {
    const offs = [
      on('new_kot', (payload) => {
        const incoming = payload?.kot;
        if (!incoming) return;
        setKots((prev) => {
          if (prev.find((k) => k._id === incoming._id)) return prev;
          return [...prev, incoming];
        });
        beep();
        toast.success(
          payload.isReprint
            ? `REPRINT · KOT ${incoming.kotNumber}`
            : payload.isIncremental
            ? `ADDITIONAL KOT ${incoming.kotNumber} · Table ${incoming.tableNumber || 'Parcel'}`
            : `NEW KOT ${incoming.kotNumber} · ${incoming.orderType === 'DINING' ? `Table ${incoming.tableNumber}` : 'Parcel'}`,
        );
        emit('kot_ack', { kotId: incoming._id });
      }),
      on('kot_print_failed', (p) => {
        toast.error(`Print failed: ${p.kotNumber}`);
      }),
      // Somebody deleted a KOT — drop the card from the board.
      on('kot_deleted', (p) => {
        setKots((prev) => prev.filter((k) => String(k._id) !== String(p?.kotId)));
      }),
    ];
    return () => offs.forEach((off) => off && off());
  }, []);

  const markAllReady = async (kot) => {
    try {
      await Promise.all(
        kot.items.map((it) =>
          ordersApi.setItemStatus(kot.order, it.orderItemId, ORDER_ITEM_STATUS.READY),
        ),
      );
      toast.success(`KOT ${kot.kotNumber} marked ready`);
    } catch (e) {
      toast.error(e.message || 'Could not update status');
    }
  };

  const reprint = async (kot) => {
    try {
      await kotsApi.reprint(kot._id);
      toast.success('Reprint queued');
    } catch (e) {
      toast.error(e.message || 'Reprint failed');
    }
  };

  /**
   * Delete a reprint. Only enabled on REPRINT cards — the backend
   * rejects attempts to delete originals (so typos are safe).
   */
  const removeKot = async (kot) => {
    if (!window.confirm(`Delete reprint ${kot.kotNumber}? The paper copy already on the pass stays — this just clears the duplicate card from the display.`)) return;
    // Optimistic: remove locally immediately; socket will confirm for others.
    setKots((prev) => prev.filter((k) => String(k._id) !== String(kot._id)));
    try {
      await kotsApi.remove(kot._id);
      toast.success(`KOT ${kot.kotNumber} deleted`);
    } catch (e) {
      toast.error(e.message || 'Delete failed');
      // Roll back if the API rejected.
      setKots((prev) => (prev.find((k) => k._id === kot._id) ? prev : [...prev, kot]));
    }
  };

  return (
    <div className="h-screen w-full bg-navy-grad flex flex-col">
      <ConnectionBanner />
      <Header
        title="Kitchen Display"
        subtitle={`${kots.length} KOT${kots.length === 1 ? '' : 's'} today`}
        onBack={false}
      />
      <main className="flex-1 overflow-auto p-4">
        {kots.length === 0 ? (
          <EmptyState
            icon={ChefHat}
            title="No tickets yet"
            description="New kitchen orders will appear here in real-time."
          />
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kots.map((k) => (
              <KotCard
                key={k._id}
                kot={k}
                onReady={markAllReady}
                onReprint={reprint}
                onDelete={removeKot}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function KotCard({ kot, onReady, onReprint, onDelete }) {
  const isAdditional = kot.kotType === 'NEW' && kot.batchNumber > 1;
  const isReprint = kot.kotType === 'REPRINT';
  return (
    <div
      className={clsx(
        'rounded-2xl border bg-panel-grad shadow-card overflow-hidden fade-in',
        isAdditional
          ? 'border-flame-500/50 shadow-[0_0_0_1px_rgba(243,148,33,0.3)]'
          : isReprint
          ? 'border-amber-500/40'
          : 'border-white/10',
      )}
    >
      <div
        className={clsx(
          'px-4 py-3 flex items-center justify-between',
          isAdditional
            ? 'bg-flame-pill text-white'
            : isReprint
            ? 'bg-amber-500 text-white'
            : 'bg-brand-500 text-white',
        )}
      >
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide font-bold opacity-90">
            {isReprint ? 'Reprint' : isAdditional ? 'Additional Order' : 'New Order'}
          </div>
          <div className="text-lg font-extrabold truncate">
            {kot.orderType === 'DINING' ? `Table ${kot.tableNumber || '—'}` : 'Parcel'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide opacity-90 font-bold">
            KOT
          </div>
          <div className="text-base font-bold">{kot.kotNumber?.split('-')?.slice(-1)?.[0]}</div>
        </div>
      </div>
      <div className="px-4 py-3 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <Clock size={12} /> {formatDate(kot.createdAt)}
        </div>
        <div>Batch #{kot.batchNumber}</div>
      </div>
      <ul className="px-4 pb-3 space-y-2">
        {kot.items.map((it, idx) => (
          <li
            key={`${it.orderItemId || idx}`}
            className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="text-slate-100 font-semibold">
                <span className="inline-block min-w-[2rem] text-flame-400 font-extrabold">
                  {it.quantity}×
                </span>
                {it.name}
              </div>
              {it.notes && (
                <div className="text-xs text-slate-400 italic mt-0.5">* {it.notes}</div>
              )}
              {it.kitchenStation && (
                <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-0.5 font-bold">
                  {it.kitchenStation}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-px bg-white/5 border-t border-white/5">
        {/* Reprint cards show Delete instead of Reprint — the paper
            dupe already exists, this button clears the on-screen card. */}
        {isReprint ? (
          <button
            onClick={() => onDelete?.(kot)}
            className="py-3 bg-ember-600 hover:bg-ember-500 text-white text-sm font-semibold flex items-center justify-center gap-2 tap-btn"
          >
            <Trash2 size={15} /> Delete
          </button>
        ) : (
          <button
            onClick={() => onReprint(kot)}
            className="py-3 bg-panel-900 hover:bg-panel-800 text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 tap-btn"
          >
            <Printer size={15} /> Reprint
          </button>
        )}
        <button
          onClick={() => onReady(kot)}
          className="py-3 bg-leaf-500 hover:bg-leaf-600 text-white text-sm font-semibold flex items-center justify-center gap-2 tap-btn"
        >
          <CheckCircle2 size={15} /> Mark Ready
        </button>
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────
let _audioCtx = null;
function beep() {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = _audioCtx.createOscillator();
    const g = _audioCtx.createGain();
    o.connect(g);
    g.connect(_audioCtx.destination);
    o.frequency.value = 880;
    o.type = 'sine';
    g.gain.setValueAtTime(0.0001, _audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, _audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, _audioCtx.currentTime + 0.35);
    o.start();
    o.stop(_audioCtx.currentTime + 0.4);
  } catch {
    /* ignore audio failures */
  }
}
