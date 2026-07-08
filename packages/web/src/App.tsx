import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ReactNode } from 'react';
import { Toaster } from '@/components/toast/Toaster';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/layouts/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NewTicketPage } from '@/pages/NewTicketPage';
import { TotemPage } from '@/pages/TotemPage';
import { TicketDetailPage } from '@/pages/TicketDetailPage';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { DepartmentsPage } from '@/pages/admin/DepartmentsPage';
import { ReportsPage } from '@/pages/admin/ReportsPage';
import { BackupPage } from '@/pages/admin/BackupPage';
import { TotemAdminPage } from '@/pages/admin/TotemAdminPage';

function Private({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/totem" element={<TotemPage />} />
        <Route path="/" element={<Private><DashboardPage /></Private>} />
        <Route path="/tickets/new" element={<Private><NewTicketPage /></Private>} />
        <Route path="/tickets/:id" element={<Private><TicketDetailPage /></Private>} />
        <Route path="/change-password" element={<Private><ChangePasswordPage /></Private>} />
        <Route
          path="/admin/users"
          element={<Private adminOnly><UsersPage /></Private>}
        />
        <Route
          path="/admin/departments"
          element={<Private adminOnly><DepartmentsPage /></Private>}
        />
        <Route
          path="/admin/reports"
          element={<Private adminOnly><ReportsPage /></Private>}
        />
        <Route
          path="/admin/backup"
          element={<Private adminOnly><BackupPage /></Private>}
        />
        <Route
          path="/admin/totem"
          element={<Private adminOnly><TotemAdminPage /></Private>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
