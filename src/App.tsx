import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/Home';
import Login from './pages/admin/Login';
import DashboardOverview from './pages/admin/DashboardOverview';
import EventsManager from './pages/admin/EventsManager';
import RegistrationsManager from './pages/admin/RegistrationsManager';
import MembersManager from './pages/admin/MembersManager';
import UsersRolesManager from './pages/admin/UsersRolesManager';
import AuditLogManager from './pages/admin/AuditLogManager';
import { useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="admin-shell min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-primary font-medium">Verifying access...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<Home />} />
      </Route>

      {/* Admin Login */}
      <Route path="/admin/login" element={<Login />} />

      {/* Protected Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardOverview />} />
        <Route path="events" element={<EventsManager />} />
        <Route path="registrations" element={<RegistrationsManager />} />
        <Route path="members" element={<MembersManager />} />
        <Route path="users-roles" element={<UsersRolesManager />} />
        <Route path="audit-logs" element={<AuditLogManager />} />
      </Route>
    </Routes>
  );
}

export default App;
