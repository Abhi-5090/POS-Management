import { Minus, Plus } from 'lucide-react';
import clsx from 'clsx';

export default function QuantityControl({
  value,
  onDecrement,
  onIncrement,
  min = 1,
  max = 999,
  size = 'md',
  disabled = false,
  className,
}) {
  const s = {
    sm: { btn: 'h-7 w-7', num: 'w-8 text-sm', gap: 'gap-1' },
    md: { btn: 'h-9 w-9', num: 'w-10 text-base', gap: 'gap-1.5' },
    lg: { btn: 'h-11 w-11', num: 'w-12 text-lg', gap: 'gap-2' },
  }[size];

  return (
    <div className={clsx('inline-flex items-center', s.gap, className)}>
      <button
        onClick={onDecrement}
        disabled={disabled || value <= min}
        className={clsx(
          'rounded-lg flex items-center justify-center tap-btn transition',
          s.btn,
          disabled || value <= min
            ? 'bg-panel-800 text-slate-500 cursor-not-allowed'
            : 'bg-panel-700 text-white hover:bg-ember-500/80',
        )}
      >
        <Minus size={16} strokeWidth={2.5} />
      </button>
      <div
        className={clsx(
          'text-center font-semibold text-white tabular-nums',
          s.num,
        )}
      >
        {value}
      </div>
      <button
        onClick={onIncrement}
        disabled={disabled || value >= max}
        className={clsx(
          'rounded-lg flex items-center justify-center tap-btn transition',
          s.btn,
          disabled || value >= max
            ? 'bg-panel-800 text-slate-500 cursor-not-allowed'
            : 'bg-brand-500 text-white hover:bg-brand-600',
        )}
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}
