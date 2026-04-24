import { LogOut, UserCircle2, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';

/**
 * Very small chrome for the Reports-only site. No tables, no kitchen,
 * nothing except a title, the current admin's name, and a logout.
 */
export default function Header({ title = 'POS Reports', subtitle, right, className }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  return (
    <header
      className={clsx(
        'flex items-center justify-between gap-3 px-4 md:px-6 py-3 bg-panel-900/80 border-b border-white/5 shadow-inset-panel',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-btn-blue">
          <FileSpreadsheet size={20} />
        </div>
        <div className="min-w-0">
          <h1 className="text-white text-lg md:text-xl font-extrabold truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-slate-400 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {right}
        {user && (
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
      </div>
    </header>
  );
}
