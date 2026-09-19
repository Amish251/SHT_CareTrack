import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './app/layout/AppShell';
import { useAuth } from './shared/components/AuthGate';
import AdminOnly from './shared/components/AdminOnly';
import SuperAdminOnly from './shared/components/SuperAdminOnly';
import DashboardPage from './features/equipment-register/pages/OverviewPage';
import MainDashboardPage from './features/dashboard/pages/DashboardPage';
import EquipmentTypePage from './features/equipment-register/pages/EquipmentTypePage';
import AddEquipmentTypePage from './features/equipment-register/pages/AddEquipmentTypePage';
import IssuePage from './features/equipment-register/pages/IssuePage';
import ActiveLoansPage from './features/equipment-register/pages/ActiveLoansPage';
import HistoryPage from './features/equipment-register/pages/HistoryPage';
import EditAllocationPage from './features/equipment-register/pages/EditAllocationPage';
import FinanceOverviewPage from './features/finance/pages/OverviewPage';
import AddEntryPage from './features/finance/pages/AddEntryPage';
import FinanceRecordsPage from './features/finance/pages/RecordsPage';
import FinanceEditEntryPage from './features/finance/pages/EditEntryPage';
import AmbajiOverviewPage from './features/accounts/ambaji/OverviewPage';
import AmbajiAddEntryPage from './features/accounts/ambaji/AddEntryPage';
import AmbajiRecordsPage from './features/accounts/ambaji/RecordsPage';
import AmbajiEditEntryPage from './features/accounts/ambaji/EditEntryPage';
import SeocOverviewPage from './features/accounts/seoc/OverviewPage';
import SeocAddEntryPage from './features/accounts/seoc/AddEntryPage';
import SeocRecordsPage from './features/accounts/seoc/RecordsPage';
import SeocEditEntryPage from './features/accounts/seoc/EditEntryPage';
import UsersPage from './features/settings/pages/UsersPage';
import ProfilePage from './features/settings/pages/ProfilePage';
import BackupPage from './features/settings/pages/BackupPage';
import LogPage from './features/settings/pages/LogPage';

/** Admins (and the super admin) land on the overview Dashboard; staff (who
 *  can't see it) land on Issue Equipment instead — their first allowed page. */
function HomeRedirect() {
  const { session } = useAuth();
  const isAdminLike = session.role === 'admin' || session.role === 'superadmin';
  return <Navigate to={isAdminLike ? '/dashboard' : '/equipment-register/active'} replace />;
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

        {/* The overview Dashboard — Equipment & Stock, Donation, Ambaji, and SEOC data
            side by side. Admin and super admin only; staff never see this route. */}
        <Route
          path="/dashboard"
          element={
            <AdminOnly message="The dashboard is limited to admin accounts.">
              <MainDashboardPage />
            </AdminOnly>
          }
        />

        {/* Equipment Register module — nav lives in the sidebar now, see app/layout/Sidebar.tsx.
            Overview and Equipment Type are admin-only; staff can issue, view active loans,
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
          path="/equipment-register/types"
          element={
            <AdminOnly message="Equipment Type is limited to admin accounts.">
              <EquipmentTypePage />
            </AdminOnly>
          }
        />
        <Route
          path="/equipment-register/types/add"
          element={
            <AdminOnly message="Equipment Type is limited to admin accounts.">
              <AddEquipmentTypePage />
            </AdminOnly>
          }
        />
        {/* Old bookmarked link — Token Overview is now folded into the Overview page above. */}
        <Route path="/equipment-register/tokens" element={<Navigate to="/equipment-register" replace />} />
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
        <Route
          path="/finance/edit/:id"
          element={
            <AdminOnly message="Donation records are limited to admin accounts.">
              <FinanceEditEntryPage />
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
        <Route
          path="/ambaji-account/edit/:id"
          element={
            <AdminOnly message="Ambaji Account is limited to admin accounts.">
              <AmbajiEditEntryPage />
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
        <Route
          path="/seoc-account/edit/:id"
          element={
            <AdminOnly message="SEOC Account is limited to admin accounts.">
              <SeocEditEntryPage />
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
