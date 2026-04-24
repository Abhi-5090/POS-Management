import clsx from 'clsx';

const VARIANTS = {
  blue: 'bg-brand-500 hover:bg-brand-600 text-white shadow-btn-blue',
  green: 'bg-leaf-600 hover:bg-leaf-500 text-white shadow-btn-green',
  orange: 'bg-flame-600 hover:bg-flame-500 text-white shadow-btn-orange',
  red: 'bg-ember-600 hover:bg-ember-500 text-white',
  ghost: 'bg-panel-700 hover:bg-panel-600 text-slate-100',
  outline: 'bg-transparent border border-white/15 text-slate-100 hover:bg-white/5',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-xl gap-2',
  lg: 'h-14 px-6 text-base rounded-2xl gap-2.5',
};

export default function Button({
  variant = 'blue',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  children,
  className,
  disabled,
  ...rest
}) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-semibold tap-btn transition-[filter,background,box-shadow,transform] duration-100 focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:saturate-75',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : Icon ? (
        <Icon size={18} strokeWidth={2.2} className="shrink-0" />
      ) : null}
      <span className="truncate">{children}</span>
      {IconRight && <IconRight size={18} strokeWidth={2.2} className="shrink-0" />}
    </button>
  );
}
