import clsx from 'clsx';

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={clsx('block', className)}>
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint && !error && (
        <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>
      )}
      {error && (
        <span className="mt-1 block text-[11px] text-ember-500 font-medium">
          {error}
        </span>
      )}
    </label>
  );
}

export function TextInput({ className, ...props }) {
  return <input className={clsx('input-dark', className)} {...props} />;
}

export function NumberInput({ className, ...props }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={clsx('input-dark tabular-nums', className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={clsx(
        'input-dark pr-8 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2394a3b8%27 stroke-width=%272.2%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27><polyline points=%276 9 12 15 18 9%27/></svg>")] bg-no-repeat bg-[right_0.75rem_center]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
      <span
        className={clsx(
          'relative inline-flex h-6 w-11 items-center rounded-full transition',
          checked ? 'bg-leaf-500' : 'bg-panel-700',
        )}
        onClick={() => onChange(!checked)}
      >
        <span
          className={clsx(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </span>
      {label && (
        <span className="text-sm text-slate-200 font-medium">{label}</span>
      )}
    </label>
  );
}
