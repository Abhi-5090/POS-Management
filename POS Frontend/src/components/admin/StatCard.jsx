import clsx from 'clsx';

const TONES = {
  blue:   'from-brand-500/20 to-brand-500/5 ring-brand-500/20 text-brand-100',
  green:  'from-leaf-500/20 to-leaf-500/5 ring-leaf-500/20 text-leaf-500',
  orange: 'from-flame-500/20 to-flame-500/5 ring-flame-500/20 text-flame-400',
  red:    'from-ember-500/20 to-ember-500/5 ring-ember-500/20 text-ember-500',
  slate:  'from-slate-500/20 to-slate-500/5 ring-slate-500/20 text-slate-200',
};

export default function StatCard({ icon: Icon, label, value, sub, tone = 'blue', loading }) {
  return (
    <div
      className={clsx(
        'relative rounded-2xl p-5 bg-gradient-to-br bg-panel-900 ring-1',
        'border border-white/5 shadow-card overflow-hidden',
        TONES[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">
            {label}
          </div>
          <div className="mt-1.5 text-2xl md:text-3xl font-extrabold text-white tabular-nums truncate">
            {loading ? <span className="opacity-40">—</span> : value}
          </div>
          {sub && (
            <div className="mt-1 text-xs text-slate-400 font-medium truncate">{sub}</div>
          )}
        </div>
        {Icon && (
          <div className="h-11 w-11 shrink-0 rounded-xl bg-white/5 flex items-center justify-center">
            <Icon size={22} />
          </div>
        )}
      </div>
    </div>
  );
}
