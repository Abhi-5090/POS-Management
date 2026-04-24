import clsx from 'clsx';

export default function PageHeader({ title, subtitle, actions, className }) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 mb-5', className)}>
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-extrabold text-white truncate">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-0.5 text-sm text-slate-400">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
