import { ArrowLeft, Bell, LogOut, UserCircle2, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import clsx from 'clsx';

export default function Header({
  title,
  subtitle,
  onBack,
  right,
  showUser = true,
  showConnection = true,
  className,
}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const connected = useSocketStore((s) => s.connected);

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header
      className={clsx(
        'flex items-center justify-between gap-3 px-4 md:px-6 py-3 bg-panel-900/80 border-b border-white/5 shadow-inset-panel',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {onBack !== false && (
          <button
            onClick={handleBack}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-panel-800 hover:bg-panel-700 text-slate-100 tap-btn"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-white text-lg md:text-xl font-bold truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-slate-400 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showConnection && (
          <div
            className={clsx(
              'hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
              connected
                ? 'bg-leaf-500/10 text-leaf-500 border border-leaf-500/20'
                : 'bg-ember-500/10 text-ember-500 border border-ember-500/20',
            )}
            title={connected ? 'Realtime online' : 'Realtime offline'}
          >
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connected ? 'Live' : 'Offline'}
          </div>
        )}
        {right}
        {showUser && user && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-panel-800 border border-white/5">
            <UserCircle2 size={20} className="text-slate-300" />
            <div className="leading-tight">
              <div className="text-sm text-white font-semibold">{user.name}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                {user.role}
              </div>
            </div>
          </div>
        )}
        {showUser && (
          <button
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-panel-800 hover:bg-ember-500/20 text-slate-300 hover:text-ember-500 tap-btn"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
