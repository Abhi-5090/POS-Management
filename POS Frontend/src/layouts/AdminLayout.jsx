import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  UtensilsCrossed,
  LayoutGrid,
  Users,
  Receipt,
  LineChart,
  ArrowLeft,
  LogOut,
  Wifi,
  WifiOff,
  ChefHat,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import ConnectionBanner from '../components/ConnectionBanner';

const NAV = [
  { to: '/admin',          label: 'Dashboard', icon: BarChart3,        end: true },
  { to: '/admin/menu',     label: 'Menu',      icon: UtensilsCrossed },
  { to: '/admin/tables',   label: 'Tables',    icon: LayoutGrid },
  { to: '/admin/staff',    label: 'Staff',     icon: Users },
  { to: '/admin/bills',    label: 'Bills',     icon: Receipt },
  { to: '/admin/reports',  label: 'Reports',   icon: LineChart },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const connected = useSocketStore((s) => s.connected);

  return (
    <div className="h-screen w-full bg-navy-950 text-slate-100 flex flex-col">
      <ConnectionBanner />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 bg-panel-900 border-r border-white/5 flex flex-col">
          <div className="px-5 py-5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-btn-blue">
                <ChefHat size={18} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-white tracking-tight">
                  POS Admin
                </div>
                <div className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">
                  Back office
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tap-btn transition',
                      isActive
                        ? 'bg-brand-500 text-white shadow-btn-blue'
                        : 'text-slate-300 hover:bg-panel-800',
                    )
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="px-3 py-3 border-t border-white/5 space-y-1">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-300 hover:bg-panel-800 tap-btn"
            >
              <ArrowLeft size={18} /> Back to POS
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-300 hover:bg-ember-500/20 hover:text-ember-500 tap-btn"
            >
              <LogOut size={18} /> Log out
            </button>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="flex items-center justify-between px-5 md:px-8 py-3 bg-panel-900/70 border-b border-white/5">
            <div className="text-sm text-slate-400">
              <span className="text-slate-300 font-semibold">{user?.name}</span>
              <span className="mx-2 text-slate-600">·</span>
              <span className="uppercase text-[11px] tracking-wide font-bold">
                {user?.role}
              </span>
            </div>
            <div
              className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                connected
                  ? 'bg-leaf-500/10 text-leaf-500 border border-leaf-500/20'
                  : 'bg-ember-500/10 text-ember-500 border border-ember-500/20',
              )}
            >
              {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {connected ? 'Live' : 'Offline'}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-5 md:px-8 py-6 fade-in">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
