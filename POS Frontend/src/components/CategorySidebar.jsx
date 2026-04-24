import clsx from 'clsx';
import { ChevronRight, UtensilsCrossed } from 'lucide-react';

/**
 *   CategorySidebar
 *   ----------------
 *   Left-hand list from the Order Entry / Parcel screens.
 *
 *   The top "All Items" tab represents the *unfiltered* view. It is
 *   selected when `activeId == null`. Selecting a real category still
 *   passes that category object to onSelect; selecting "All Items"
 *   passes `null`. The parent drives the filter state from that.
 */
export default function CategorySidebar({
  categories = [],
  activeId,
  onSelect,
  accent = 'blue',
  showAll = true,
  className,
}) {
  const activeCls =
    accent === 'orange'
      ? 'bg-flame-pill text-white shadow-btn-orange'
      : 'bg-brand-500 text-white shadow-btn-blue';

  const isAllActive = activeId == null;

  return (
    <aside
      className={clsx(
        'flex flex-col bg-navy-900 border-r border-white/5 w-52 md:w-60 shrink-0',
        className,
      )}
    >
      {showAll && (
        <button
          onClick={() => onSelect?.(null)}
          className={clsx(
            'mx-3 mt-3 rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2 tap-btn transition-all',
            isAllActive
              ? activeCls
              : 'bg-panel-800 text-slate-200 hover:bg-panel-700 border border-white/5',
          )}
        >
          <UtensilsCrossed size={18} />
          <span>All Items</span>
        </button>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {categories.map((c) => {
          const active = c._id === activeId;
          return (
            <button
              key={c._id}
              onClick={() => onSelect?.(c)}
              className={clsx(
                'w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg text-sm font-semibold tap-btn transition-all',
                active
                  ? 'bg-panel-700 text-white border border-white/10'
                  : 'bg-panel-800 text-slate-200 hover:bg-panel-700 border border-transparent',
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                {c.color && (
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: c.color }}
                  />
                )}
                <span className="truncate">{c.name}</span>
              </span>
              <ChevronRight size={16} className="text-slate-400 shrink-0" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
