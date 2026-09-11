import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './app/layout/AppShell';
import { useAuth } from './shared/components/AuthGate';
import AdminOnly from './shared/components/AdminOnly';
import SuperAdminOnly from './shared/components/SuperAdminOnly';
import DashboardPage from './features/equipment-register/pages/DashboardPage';
import IssuePage from './features/equipment-register/pages/IssuePage';
import ActiveLoansPage from './features/equipment-register/pages/ActiveLoansPage';
import HistoryPage from './features/equipment-register/pages/HistoryPage';
import TokenOverviewPage from './features/equipment-register/pages/TokenOverviewPage';
import EditAllocationPage from './features/equipment-register/pages/EditAllocationPage';
import FinanceOverviewPage from './features/finance/pages/OverviewPage';
import AddEntryPage from './features/finance/pages/AddEntryPage';
import FinanceRecordsPage from './features/finance/pages/RecordsPage';
import AmbajiOverviewPage from './features/accounts/ambaji/OverviewPage';
import AmbajiAddEntryPage from './features/accounts/ambaji/AddEntryPage';
import AmbajiRecordsPage from './features/accounts/ambaji/RecordsPage';
import SeocOverviewPage from './features/accounts/seoc/OverviewPage';
import SeocAddEntryPage from './features/accounts/seoc/AddEntryPage';
import SeocRecordsPage from './features/accounts/seoc/RecordsPage';
import UsersPage from './features/settings/pages/UsersPage';
import ProfilePage from './features/settings/pages/ProfilePage';
import BackupPage from './features/settings/pages/BackupPage';
import LogPage from './features/settings/pages/LogPage';

/** Admins (and the super admin) land on the Equipment Dashboard; staff (who
 *  can't see Dashboard or Donation) land on Issue Equipment instead — their
 *  first allowed page. */
function HomeRedirect() {
  const { session } = useAuth();
  const isAdminLike = session.role === 'admin' || session.role === 'superadmin';
  return <Navigate to={isAdminLike ? '/equipment-register' : '/equipment-register/issue'} replace />;
}

/** Admins (and the super admin) land on Users first; staff (who can't see
 *  Users or Backup) land on their own login instead. */
function SettingsIndexRedirect() {
  const { session } = useAuth();
  const isAdminLike = session.role === 'admin' || session.role === 'superadmin';
  return <Navigate to={isAdminLike ? '/settings/users' : '/settings/profile'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomeRedirect />} />

        {/* Equipment Register module — nav lives in the sidebar now, see app/layout/Sidebar.tsx.
            Dashboard (adding equipment types) is admin-only; staff can issue, view active loans,
            and browse history but can't add/remove equipment types. */}
        <Route
          path="/equipment-register"
          element={
            <AdminOnly message="Ask an admin to add or manage equipment types for you.">
              <DashboardPage />
            </AdminOnly>
          }
        />
        <Route path="/equipment-register/issue" element={<IssuePage />} />
        <Route path="/equipment-register/active" element={<ActiveLoansPage />} />
        <Route path="/equipment-register/history" element={<HistoryPage />} />
        <Route
          path="/equipment-register/tokens"
          element={
            <AdminOnly message="Token Overview is limited to admin accounts.">
              <TokenOverviewPage />
            </AdminOnly>
          }
        />
        <Route path="/equipment-register/edit/:id" element={<EditAllocationPage />} />

        {/* Finance module — admin-only. Staff accounts never see donation/expense records. */}
        <Route
          path="/finance"
          element={
            <AdminOnly message="Donation records are limited to admin accounts.">
              <FinanceOverviewPage />
            </AdminOnly>
          }
        />
        <Route
          path="/finance/add"
          element={
            <AdminOnly message="Donation records are limited to admin accounts.">
              <AddEntryPage />
            </AdminOnly>
          }
        />
        <Route
          path="/finance/records"
          element={
            <AdminOnly message="Donation records are limited to admin accounts.">
              <FinanceRecordsPage />
            </AdminOnly>
          }
        />

        {/* Ambaji Account — its own credit/debit ledger, admin-only, fully isolated
            from Donation and from SEOC Account (separate Supabase namespace/table row). */}
        <Route
          path="/ambaji-account"
          element={
            <AdminOnly message="Ambaji Account is limited to admin accounts.">
              <AmbajiOverviewPage />
            </AdminOnly>
          }
        />
        <Route
          path="/ambaji-account/add"
          element={
            <AdminOnly message="Ambaji Account is limited to admin accounts.">
              <AmbajiAddEntryPage />
            </AdminOnly>
          }
        />
        <Route
          path="/ambaji-account/records"
          element={
            <AdminOnly message="Ambaji Account is limited to admin accounts.">
              <AmbajiRecordsPage />
            </AdminOnly>
          }
        />

        {/* SEOC Account — its own credit/debit ledger, admin-only, fully isolated
            from Donation and from Ambaji Account (separate Supabase namespace/table row). */}
        <Route
          path="/seoc-account"
          element={
            <AdminOnly message="SEOC Account is limited to admin accounts.">
              <SeocOverviewPage />
            </AdminOnly>
          }
        />
        <Route
          path="/seoc-account/add"
          element={
            <AdminOnly message="SEOC Account is limited to admin accounts.">
              <SeocAddEntryPage />
            </AdminOnly>
          }
        />
        <Route
          path="/seoc-account/records"
          element={
            <AdminOnly message="SEOC Account is limited to admin accounts.">
              <SeocRecordsPage />
            </AdminOnly>
          }
        />

        {/* Settings — users & backup are admin-only (see role checks inside those pages
            and the sidebar filter in app/layout/Sidebar.tsx); My Login is open to everyone. */}
        <Route path="/settings" element={<SettingsIndexRedirect />} />
        <Route path="/settings/users" element={<UsersPage />} />
        <Route path="/settings/profile" element={<ProfilePage />} />
        <Route path="/settings/backup" element={<BackupPage />} />
        <Route
          path="/settings/log"
          element={
            <SuperAdminOnly>
              <LogPage />
            </SuperAdminOnly>
          }
        />

        {/* Next module gets its own routes here, e.g. /volunteers, plus an entry in Sidebar.tsx */}
      </Route>
    </Routes>
  );
}
