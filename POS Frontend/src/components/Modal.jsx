import { X } from 'lucide-react';
import { useEffect } from 'react';
import clsx from 'clsx';

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closable = true,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && closable) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closable, onClose]);

  if (!open) return null;

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closable ? onClose : undefined}
      />
      <div
        className={clsx(
          'relative w-full rounded-2xl bg-panel-800 border border-white/10 shadow-card-lg overflow-hidden',
          widths[size],
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-panel-900/60">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {closable && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-300"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <div className="px-6 py-5 text-slate-200">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-white/5 bg-panel-900/40 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
