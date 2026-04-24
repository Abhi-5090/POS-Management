import clsx from 'clsx';
import { Users, SplitSquareHorizontal } from 'lucide-react';

const VARIANTS = {
  free: {
    bg: 'bg-green-pill',
    label: 'Available',
  },
  occupied: {
    bg: 'bg-red-pill',
    label: 'Occupied',
  },
  reserved: {
    bg: 'bg-gradient-to-b from-amber-400 to-amber-600',
    label: 'Reserved',
  },
};

const SEAT_LABELS = ['A', 'B', 'C', 'D'];

/**
 *  TableCard
 *  ---------
 *  Three visual modes:
 *
 *   1. Normal whole table — single big card, green (free) / red (occupied) /
 *      amber (reserved), same as before.
 *   2. Split mode — 4 mini-buttons A/B/C/D with per-seat colouring.
 *      Entered by the "Split" pill on a free table, or automatically
 *      when the backend reports any active seat session for this table.
 *
 *  Click semantics are pushed up to the parent via onClick(table, { seatLabel? }).
 */
export default function TableCard({
  table,
  onClick,
  onSplit,
  onUnsplit,
  draftCount = 0,
  splitRequested = false,
  className,
}) {
  const status = table.status || 'free';
  const v = VARIANTS[status] || VARIANTS.free;

  const active = table.activeSessions || [];
  const seatSessions = active.filter((s) => !!s.seatLabel);
  // `canUnsplit` = the split was just requested (no backend commit yet)
  // so collapsing is purely a UI state change. Once any seat session
  // exists we can't collapse because there are real orders attached.
  const canUnsplit = splitRequested && seatSessions.length === 0;
  const isSplit = seatSessions.length > 0 || (splitRequested && status !== 'occupied');

  if (isSplit) {
    return (
      <SplitCard
        table={table}
        seatSessions={seatSessions}
        onClick={onClick}
        onUnsplit={canUnsplit ? onUnsplit : null}
        className={className}
      />
    );
  }

  // Normal whole-table card.
  const wholeSession = active.find((s) => !s.seatLabel);
  const itemCount = wholeSession?.order?.items?.length || 0;

  return (
    <button
      onClick={() => onClick?.(table, {})}
      className={clsx(
        'relative w-full h-28 md:h-32 rounded-2xl p-4 text-left text-white overflow-hidden',
        'tap-btn transition-transform duration-100 hover:-translate-y-0.5 active:translate-y-0',
        'shadow-card border border-white/10',
        v.bg,
        className,
      )}
    >
      <div className="absolute inset-0 bg-black/5 pointer-events-none" />
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xl md:text-2xl font-extrabold leading-tight">
            Table {table.number}
          </div>
          <div className="text-white/90 text-sm mt-0.5 font-medium">{v.label}</div>
        </div>
        <div className="shrink-0 text-right flex flex-col items-end gap-1">
          <div className="inline-flex items-center gap-1 text-xs font-semibold bg-black/15 px-2 py-0.5 rounded-md">
            <Users size={12} /> {table.capacity}
          </div>
          {status !== 'occupied' && draftCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-flame-pill text-white shadow-btn-orange">
              DRAFT · {draftCount}
            </span>
          )}
        </div>
      </div>
      {status === 'occupied' && (
        <div className="absolute left-4 right-4 bottom-2.5 text-[11px] font-medium text-white/85 truncate">
          {wholeSession?.sessionCode ? `Ses ${wholeSession.sessionCode}` : ''}
          {itemCount ? ` · ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''}
        </div>
      )}
      {status !== 'occupied' && onSplit && (
        // "Split" pill — only visible on free tables, lets the cashier
        // break this table into A/B/C/D seats for separate bills.
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSplit(table);
          }}
          className="absolute bottom-2.5 left-4 text-[10px] uppercase tracking-wide font-bold bg-black/25 hover:bg-black/40 text-white px-2 py-0.5 rounded-md inline-flex items-center gap-1"
        >
          <SplitSquareHorizontal size={11} /> Split
        </button>
      )}
    </button>
  );
}

function SplitCard({ table, seatSessions, onClick, onUnsplit, className }) {
  const bySeat = new Map(seatSessions.map((s) => [s.seatLabel, s]));
  // If the split was just requested (no seat is actually busy yet),
  // tapping anywhere on the card EXCEPT a seat tile collapses back to
  // the whole-table card. When at least one seat is busy, background
  // clicks are ignored (you can't collapse real orders).
  const collapseOnBgClick = !!onUnsplit;

  const onBackgroundClick = (e) => {
    // We only fire when the click bubbled up from the background —
    // seat buttons stop propagation before this handler sees them.
    if (collapseOnBgClick) onUnsplit?.(table);
  };

  return (
    <div
      onClick={onBackgroundClick}
      role={collapseOnBgClick ? 'button' : undefined}
      title={collapseOnBgClick ? 'Tap here to collapse back to whole table' : undefined}
      className={clsx(
        'relative w-full rounded-2xl p-3 border border-white/10 shadow-card bg-panel-grad',
        collapseOnBgClick && 'cursor-pointer hover:border-white/20 tap-btn',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div>
          <div className="text-white font-extrabold text-sm md:text-base leading-tight">
            Table {table.number}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-flame-400 font-bold">
            Split · {seatSessions.length}/4 seats in use
            {collapseOnBgClick && (
              <span className="text-slate-400 font-medium normal-case">
                {' '}
                · tap background to cancel
              </span>
            )}
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-semibold">
          <Users size={11} className="inline -mt-0.5" /> {table.capacity}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {SEAT_LABELS.map((seat) => {
          const session = bySeat.get(seat);
          const busy = !!session;
          return (
            <button
              key={seat}
              onClick={(e) => {
                // Don't let seat clicks bubble up to the background
                // handler — otherwise tapping a seat would both open
                // the draft AND collapse the split.
                e.stopPropagation();
                onClick?.(table, { seatLabel: seat });
              }}
              className={clsx(
                'h-14 rounded-lg px-2 text-left text-white tap-btn transition-transform',
                'hover:-translate-y-0.5 active:translate-y-0 shadow border',
                busy
                  ? 'bg-red-pill border-ember-700'
                  : 'bg-green-pill border-leaf-700',
              )}
            >
              <div className="flex items-start justify-between">
                <span className="font-extrabold text-base">{seat}</span>
                <span className="text-[9px] uppercase tracking-wide font-bold opacity-90">
                  {busy ? 'busy' : 'free'}
                </span>
              </div>
              {busy && (
                <div className="text-[10px] text-white/85 truncate mt-0.5">
                  {session.sessionCode}
                  {session.order?.items?.length
                    ? ` · ${session.order.items.length}`
                    : ''}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
