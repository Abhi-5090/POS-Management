import { Link } from 'react-router-dom';
import Button from '../components/Button';
import { Home } from 'lucide-react';

export default function NotFoundPage({ code = 404, message = 'Page not found' }) {
  return (
    <div className="min-h-screen w-full bg-navy-grad flex items-center justify-center p-6">
      <div className="pos-panel p-10 text-center max-w-md w-full">
        <div className="text-6xl font-extrabold text-brand-500">{code}</div>
        <div className="mt-2 text-slate-200 font-semibold">{message}</div>
        <Link to="/" className="inline-block mt-6">
          <Button variant="blue" icon={Home}>
            Back to editor
          </Button>
        </Link>
      </div>
    </div>
  );
}
