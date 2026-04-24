import { WifiOff } from 'lucide-react';
import { useSocketStore } from '../store/socketStore';

/**
 * Shown at the very top when we've lost realtime. Useful for cashiers
 * so they know kitchen sync may be delayed.
 */
export default function ConnectionBanner() {
  const connected = useSocketStore((s) => s.connected);
  if (connected) return null;
  return (
    <div className="w-full bg-ember-500/15 border-b border-ember-500/30 text-ember-500 text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-2">
      <WifiOff size={14} />
      Realtime offline — reconnecting…
    </div>
  );
}
