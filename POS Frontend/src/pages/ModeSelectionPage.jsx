import { Link, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, ShoppingBag, LayoutGrid, LogOut, Shield } from 'lucide-react';
import ModeCard from '../components/ModeCard';
import ConnectionBanner from '../components/ConnectionBanner';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import clsx from 'clsx';

export default function ModeSelectionPage() {
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuthStore();
  const connected = useSocketStore((s) => s.connected);

  return (
    <div className="h-screen w-full bg-navy-grad flex flex-col">
      <ConnectionBanner />

      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-5xl">
          <div className="flex items-center justify-between mb-8 px-2">
            <div>
              <div className="text-slate-400 text-sm font-semibold">
                Signed in as <span className="text-white capitalize">{user?.role}</span>
              </div>
              <div className="text-slate-500 text-xs">{user?.name}</div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  'hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                  connected
                    ? 'bg-leaf-500/10 text-leaf-500 border border-leaf-500/20'
                    : 'bg-ember-500/10 text-ember-500 border border-ember-500/20',
                )}
              >
                {connected ? '● Live' : '○ Offline'}
              </div>
              {hasRole('admin') && (
                <Link
                  to="/admin"
                  className="px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-sm text-white border border-brand-500 tap-btn inline-flex items-center gap-2 shadow-btn-blue"
                >
                  <Shield size={16} /> Admin
                </Link>
              )}
              {hasRole('kitchen', 'admin') && (
                <Link
                  to="/kitchen"
                  className="px-3 py-2 rounded-xl bg-panel-800 hover:bg-panel-700 text-sm text-slate-100 border border-white/10 tap-btn inline-flex items-center gap-2"
                >
                  <LayoutGrid size={16} /> Kitchen Display
                </Link>
              )}
              <button
                onClick={() => {
                  logout();
                  navigate('/login', { replace: true });
                }}
                className="px-3 py-2 rounded-xl bg-panel-800 hover:bg-ember-500/20 text-slate-300 hover:text-ember-500 text-sm border border-white/10 tap-btn inline-flex items-center gap-2"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>

          <div className="pos-panel p-6 md:p-10">
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Welcome to Restaurant POS
              </h1>
              <div className="mt-2 h-1 w-16 bg-brand-500 rounded-full mx-auto" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
              <ModeCard
                icon={UtensilsCrossed}
                title="Dine-In"
                subtitle="Manage Tables"
                variant="blue"
                onClick={() => navigate('/tables')}
              />
              <ModeCard
                icon={ShoppingBag}
                title="Takeaway"
                subtitle="Parcel Orders"
                variant="orange"
                onClick={() => navigate('/parcel')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
