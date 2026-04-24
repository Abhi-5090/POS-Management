import clsx from 'clsx';

const VARIANTS = {
  orange:
    'bg-flame-pill text-white shadow-btn-orange hover:brightness-105 active:brightness-95',
  green:
    'bg-green-pill text-white shadow-btn-green hover:brightness-105 active:brightness-95',
  red: 'bg-red-pill text-white shadow-btn-red hover:brightness-105 active:brightness-95',
  blue: 'bg-brand-500 hover:bg-brand-600 text-white shadow-btn-blue',
  ghost: 'bg-panel-700 hover:bg-panel-600 text-slate-100',
  outline:
    'bg-transparent border border-white/15 text-slate-100 hover:bg-white/5',
  subtle: 'bg-panel-800 hover:bg-panel-700 text-slate-200',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-xl gap-2',
  lg: 'h-14 px-6 text-base rounded-2xl gap-2.5',
  xl: 'h-16 px-8 text-lg rounded-2xl gap-3',
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
        <Icon className="shrink-0" size={18} strokeWidth={2.2} />
      ) : null}
      <span className="truncate">{children}</span>
      {IconRight ? <IconRight className="shrink-0" size={18} strokeWidth={2.2} /> : null}
    </button>
  );
}
