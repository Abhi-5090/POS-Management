import clsx from 'clsx';
import Loader from '../Loader';
import EmptyState from '../EmptyState';

/**
 * Minimal responsive table for admin lists.
 *
 *   columns: [{ key, label, render?, className?, align? }]
 *   rows:    array of row objects
 *   rowKey:  (row) => string (defaults to row._id)
 *   onRowClick: (row) => void  (optional)
 */
export default function DataTable({
  columns,
  rows,
  rowKey = (r) => r._id,
  loading = false,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  onRowClick,
}) {
  if (loading) return <Loader label="Loading…" />;
  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="overflow-auto rounded-xl border border-white/5">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-panel-900/80 text-slate-400 uppercase text-[11px] tracking-wide">
            {columns.map((c) => (
              <th
                key={c.key}
                className={clsx(
                  'px-4 py-2.5 text-left font-semibold whitespace-nowrap',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                  c.className,
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(
                'bg-panel-800/60 transition',
                onRowClick && 'cursor-pointer hover:bg-panel-700/80',
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={clsx(
                    'px-4 py-3 text-slate-200 align-middle',
                    c.align === 'right' && 'text-right tabular-nums',
                    c.align === 'center' && 'text-center',
                    c.className,
                  )}
                >
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
