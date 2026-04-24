import clsx from 'clsx';
import { Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import QuantityControl from './QuantityControl';
import { money } from '../utils/format';
import { ORDER_ITEM_STATUS, STATUS_COLOR, STATUS_LABEL } from '../utils/constants';

/**
 *   OrderSummary (right panel)
 *   --------------------------
 *   Shows all items on the current order. "NEW" items are editable
 *   (qty ± / remove). Already-SENT items are displayed read-only with
 *   their current kitchen status.
 *
 *   Footer renders totals + the CTAs supplied by the parent ("Send to
 *   Kitchen", "Generate Bill" for dine-in; "Place Order", "Clear" for
 *   parcel). The parent owns the logic — this component just renders.
 */
export default function OrderSummary({
  title = 'Order Summary',
  items = [],
  subtitle,
  onIncrement,
  onDecrement,
  onRemove,
  actions,
  totals, // optional { subtotal, tax, discount, total }
  showStatus = true,
  readOnly = false,
  className,
}) {
  const hasItems = items.length > 0;
  const newItemsCount = items.filter((i) => i.status === ORDER_ITEM_STATUS.NEW).length;
  const sentItemsCount = items.filter(
    (i) => i.status && i.status !== ORDER_ITEM_STATUS.NEW && i.status !== ORDER_ITEM_STATUS.CANCELLED,
  ).length;

  return (
    <aside
      className={clsx(
        'flex flex-col bg-white rounded-2xl shadow-card overflow-hidden border border-white/5',
        className,
      )}
    >
      <header className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
        <div>
          <h3 className="text-slate-900 font-bold">{title}</h3>
          {subtitle && (
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
        {(newItemsCount > 0 || sentItemsCount > 0) && showStatus && (
          <div className="flex items-center gap-1.5">
            {newItemsCount > 0 && (
              <span className="pos-chip bg-flame-500/15 text-flame-600 border border-flame-500/30">
                <AlertCircle size={12} className="mr-1" />
                {newItemsCount} new
              </span>
            )}
            {sentItemsCount > 0 && (
              <span className="pos-chip bg-leaf-500/15 text-leaf-700 border border-leaf-500/30">
                <CheckCircle2 size={12} className="mr-1" />
                {sentItemsCount} sent
              </span>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 bg-white">
        {!hasItems && (
          <div className="h-full flex items-center justify-center p-8 text-slate-400 text-sm">
            No items yet. Tap an item on the menu to add.
          </div>
        )}
        {items.map((item) => {
          const isNew = item.status === ORDER_ITEM_STATUS.NEW || !item.status;
          const canEdit = !readOnly && isNew;
          return (
            <div key={item._id || `${item.menuItem}-${Math.random()}`} className="px-4 py-3 bg-white">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-lg">
                  🍽️
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-slate-900 font-semibold text-[15px] truncate">
                      {item.quantity}x {item.name}
                    </div>
                    <div className="text-slate-900 font-semibold tabular-nums shrink-0">
                      - {money(item.price * item.quantity)}
                    </div>
                  </div>
                  {item.notes && (
                    <div className="text-slate-500 text-xs mt-0.5 italic truncate">
                      * {item.notes}
                    </div>
                  )}
                  {showStatus && item.status && !isNew && (
                    <div className="mt-1.5">
                      <span
                        className={clsx(
                          'pos-chip bg-slate-200 text-slate-700 !bg-opacity-100',
                          {
                            '!bg-sky-100 !text-sky-800':
                              item.status === ORDER_ITEM_STATUS.SENT_TO_KITCHEN,
                            '!bg-amber-100 !text-amber-800':
                              item.status === ORDER_ITEM_STATUS.PREPARING,
                            '!bg-emerald-100 !text-emerald-800':
                              item.status === ORDER_ITEM_STATUS.READY,
                            '!bg-slate-100 !text-slate-700':
                              item.status === ORDER_ITEM_STATUS.SERVED,
                            '!bg-rose-100 !text-rose-800':
                              item.status === ORDER_ITEM_STATUS.CANCELLED,
                          },
                        )}
                      >
                        {STATUS_LABEL[item.status] || item.status}
                      </span>
                    </div>
                  )}
                  {canEdit && (
                    <div className="flex items-center justify-between mt-2">
                      <QuantityControl
                        value={item.quantity}
                        onDecrement={() => onDecrement?.(item)}
                        onIncrement={() => onIncrement?.(item)}
                        size="sm"
                      />
                      <button
                        onClick={() => onRemove?.(item)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-ember-500 hover:bg-ember-500/10 tap-btn"
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totals && (
        <div className="px-5 pt-3 pb-1 bg-slate-50 border-t border-slate-200 text-sm">
          <Row label="Subtotal" value={money(totals.subtotal)} />
          {!!totals.discount && (
            <Row label="Discount" value={`- ${money(totals.discount)}`} tone="green" />
          )}
          {!!totals.tax && <Row label="Tax" value={money(totals.tax)} />}
          <div className="mt-1 pt-2 border-t border-slate-200 flex items-center justify-between">
            <div className="text-slate-900 font-bold">Total</div>
            <div className="text-slate-900 font-extrabold text-lg tabular-nums">
              {money(totals.total)}
            </div>
          </div>
        </div>
      )}

      {actions && (
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          {actions}
        </div>
      )}
    </aside>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="text-slate-500">{label}</div>
      <div
        className={clsx(
          'tabular-nums font-semibold',
          tone === 'green' ? 'text-leaf-700' : 'text-slate-800',
        )}
      >
        {value}
      </div>
    </div>
  );
}
