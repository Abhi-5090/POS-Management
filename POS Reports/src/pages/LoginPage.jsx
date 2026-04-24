import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, User, FileSpreadsheet, ShieldAlert } from 'lucide-react';
import Button from '../components/Button';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setError(null);
    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      if (user.role !== 'admin') {
        // Reports editing is admin-only — refuse at the door so a
        // stale cashier JWT can't land on the editor.
        toast.error('Reports editor is admin-only.');
        setError('Only admin users can access the reports editor.');
        useAuthStore.getState().logout();
        setLoading(false);
        return;
      }
      toast.success(`Welcome, ${user.name}`);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-navy-grad flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-[28rem] h-[28rem] bg-brand-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-[28rem] h-[28rem] bg-flame-500/20 rounded-full blur-3xl" />

      <form
        onSubmit={submit}
        className="relative w-full max-w-md pos-panel p-8 space-y-5 fade-in"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-16 w-16 rounded-2xl bg-brand-500 flex items-center justify-center shadow-btn-blue">
            <FileSpreadsheet size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">POS Reports</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Admin sign-in — Daily Report editor
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Username
            </label>
            <div className="relative mt-1">
              <User
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-dark pl-10"
                placeholder="admin"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Password
            </label>
            <div className="relative mt-1">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark pl-10"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-ember-500/10 border border-ember-500/30 text-ember-500 text-xs font-medium px-3 py-2">
            <ShieldAlert size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Button variant="blue" size="lg" className="w-full" loading={loading} type="submit">
          Sign In
        </Button>

        <div className="text-[11px] text-center text-slate-500">
          This site only manages daily income reports. For taking orders,
          use the main POS app.
        </div>
      </form>
    </div>
  );
}
