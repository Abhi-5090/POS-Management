import { Inbox } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description = '',
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 gap-3 text-slate-400">
      <div className="h-16 w-16 rounded-2xl bg-panel-800 flex items-center justify-center text-slate-500">
        <Icon size={28} />
      </div>
      <div className="text-slate-200 font-semibold">{title}</div>
      {description && <div className="text-sm max-w-sm">{description}</div>}
      {action}
    </div>
  );
}
