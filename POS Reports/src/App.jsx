import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import EditReportsPage from './pages/EditReportsPage';
import NotFoundPage from './pages/NotFoundPage';

const ADMIN = ['admin'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute roles={ADMIN}>
            <EditReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:dateKey"
        element={
          <ProtectedRoute roles={ADMIN}>
            <EditReportsPage />
          </ProtectedRoute>
        }
      />

      <Route path="/403" element={<NotFoundPage code={403} message="Access denied" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
