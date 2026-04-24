import { Loader2 } from 'lucide-react';

export default function Loader({ label = 'Loading…', fullscreen = false }) {
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-navy-950/80 backdrop-blur-sm">
        <Loader2 className="animate-spin text-brand-500" size={36} />
        <div className="text-slate-300 text-sm">{label}</div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-2 p-4 text-slate-300">
      <Loader2 className="animate-spin" size={18} /> {label}
    </div>
  );
}
