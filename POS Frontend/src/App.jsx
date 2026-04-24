import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ModeSelectionPage from './pages/ModeSelectionPage';
import TablesPage from './pages/TablesPage';
import OrderEntryPage from './pages/OrderEntryPage';
import DraftOrderPage from './pages/DraftOrderPage';
import ParcelOrderPage from './pages/ParcelOrderPage';
import KitchenDisplayPage from './pages/KitchenDisplayPage';
import NotFoundPage from './pages/NotFoundPage';

// Admin
import AdminLayout from './layouts/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import AdminMenuPage from './pages/admin/MenuPage';
import AdminTablesPage from './pages/admin/TablesPage';
import AdminStaffPage from './pages/admin/StaffPage';
import AdminBillsPage from './pages/admin/BillsPage';
import AdminReportsPage from './pages/admin/ReportsPage';
import { useAuthStore } from './store/authStore';
import { useSocketStore } from './store/socketStore';
import { USER_ROLE } from './utils/constants';

export default function App() {
  const { isAuthenticated, user } = useAuthStore();
  const { start, stop } = useSocketStore();

  // Open/close the socket alongside auth lifecycle. The socket is
  // auto-routed to role-based rooms by the server based on the JWT.
  useEffect(() => {
    if (isAuthenticated) {
      const stations = user?.role === USER_ROLE.KITCHEN ? ['main', 'tandoor', 'beverage'] : [];
      start({ stations });
    } else {
      stop();
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ModeSelectionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tables"
        element={
          <ProtectedRoute roles={[USER_ROLE.ADMIN, USER_ROLE.CASHIER, USER_ROLE.WAITER]}>
            <TablesPage />
          </ProtectedRoute>
        }
      />
      {/* Draft (local, no backend commit yet) — /order/new/:tableId */}
      <Route
        path="/order/new/:tableId"
        element={
          <ProtectedRoute roles={[USER_ROLE.ADMIN, USER_ROLE.CASHIER, USER_ROLE.WAITER]}>
            <DraftOrderPage />
          </ProtectedRoute>
        }
      />
      {/* Draft for a specific seat in split-table mode. */}
      <Route
        path="/order/new/:tableId/seat/:seatLabel"
        element={
          <ProtectedRoute roles={[USER_ROLE.ADMIN, USER_ROLE.CASHIER, USER_ROLE.WAITER]}>
            <DraftOrderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/order/:orderId"
        element={
          <ProtectedRoute roles={[USER_ROLE.ADMIN, USER_ROLE.CASHIER, USER_ROLE.WAITER]}>
            <OrderEntryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parcel"
        element={
          <ProtectedRoute roles={[USER_ROLE.ADMIN, USER_ROLE.CASHIER]}>
            <ParcelOrderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kitchen"
        element={
          <ProtectedRoute roles={[USER_ROLE.ADMIN, USER_ROLE.KITCHEN]}>
            <KitchenDisplayPage />
          </ProtectedRoute>
        }
      />

      {/* Reports editing lives in the standalone POS Reports app. */}

      {/* Admin area — sidebar layout with nested routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={[USER_ROLE.ADMIN]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="menu" element={<AdminMenuPage />} />
        <Route path="tables" element={<AdminTablesPage />} />
        <Route path="staff" element={<AdminStaffPage />} />
        <Route path="bills" element={<AdminBillsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
      </Route>

      <Route path="/403" element={<NotFoundPage code={403} message="Access denied" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
