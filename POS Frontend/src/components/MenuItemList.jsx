import clsx from 'clsx';
import { Plus, UtensilsCrossed } from 'lucide-react';
import { money } from '../utils/format';
import EmptyState from './EmptyState';

const TYPE_BADGE = {
  veg: 'bg-leaf-500',
  'non-veg': 'bg-ember-500',
  egg: 'bg-amber-500',
};

/**
 *   MenuItemList
 *   -------------
 *   Middle column from the Order Entry screen. Flat scrollable list of
 *   menu items — one tap adds to the cart. Shows an emoji-like icon
 *   circle on the left and the price on the right.
 */
export default function MenuItemList({
  items = [],
  loading = false,
  search,
  onSelect,
  disabled = false,
  showCategory = false,
}) {
  if (!loading && items.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title={search ? 'No items match your search' : 'No items in this category'}
        description="Try another category, or clear your search."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-white/5">
      {items.map((item) => (
        <li key={item._id}>
          <button
            disabled={disabled || !item.isAvailable}
            onClick={() => onSelect?.(item)}
            className={clsx(
              'group w-full flex items-center gap-3 px-4 py-3.5 text-left tap-btn transition',
              disabled || !item.isAvailable
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-white/5 active:bg-white/10',
            )}
          >
            <div className="relative h-10 w-10 shrink-0 rounded-full bg-panel-700 overflow-hidden flex items-center justify-center">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">🍽️</span>
              )}
              <span
                className={clsx(
                  'absolute -top-0.5 -left-0.5 h-2.5 w-2.5 rounded-full border-2 border-navy-900',
                  TYPE_BADGE[item.type] || TYPE_BADGE.veg,
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-slate-100 font-semibold truncate">{item.name}</div>
              {showCategory && item.category?.name && (
                <div className="text-[11px] font-semibold text-slate-500 truncate uppercase tracking-wide">
                  {item.category.name}
                </div>
              )}
              {item.description && (
                <div className="text-slate-400 text-xs truncate">{item.description}</div>
              )}
              {!item.isAvailable && (
                <div className="text-ember-500 text-xs mt-0.5 font-medium">Unavailable</div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-slate-100 font-semibold tabular-nums">
                - {money(item.price)}
              </div>
            </div>
            <div className="shrink-0 h-8 w-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition">
              <Plus size={16} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
