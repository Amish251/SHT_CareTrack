import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/components/AuthGate';
import { LogOut } from 'lucide-react';

interface NavChild {
  to: string;
  label: string;
  tag: string;
  end?: boolean;
  /** Hidden from the sidebar for staff — the page itself also gates on role. */
  adminOnly?: boolean;
  /** Hidden from everyone except the super admin. */
  superAdminOnly?: boolean;
}

interface NavItem {
  to: string;
  label: string;
  tag: string;
  children: NavChild[];
  /** Hides this whole module from the sidebar for staff. */
  adminOnly?: boolean;
}

// Each module contributes one entry with its own sub-pages here.
// Add a new object to this array when a new feature module is scaffolded.
const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    tag: 'DB',
    adminOnly: true,
    children: []
  },
  {
    to: '/equipment-register',
    label: 'Equipment Register',
    tag: 'ER',
    children: [
      { to: '/equipment-register', label: 'Equipment & Stock', tag: '01', end: true, adminOnly: true },
      { to: '/equipment-register/issue', label: 'Issue Equipment', tag: '02' },
      { to: '/equipment-register/active', label: 'Active Loans', tag: '03' },
      { to: '/equipment-register/history', label: 'Full History', tag: '04' },
      { to: '/equipment-register/tokens', label: 'Token Overview', tag: '05', adminOnly: true }
    ]
  },
  {
    to: '/finance',
    label: 'Donation',
    tag: 'DN',
    adminOnly: true,
    children: [
      { to: '/finance', label: 'Overview', tag: '01', end: true },
      { to: '/finance/add', label: 'Add Entry', tag: '02' },
      { to: '/finance/records', label: 'All Records', tag: '03' }
    ]
  },
  {
    to: '/ambaji-account',
    label: 'Ambaji Account',
    tag: 'AM',
    adminOnly: true,
    children: [
      { to: '/ambaji-account', label: 'Overview', tag: '01', end: true },
      { to: '/ambaji-account/add', label: 'Add Entry', tag: '02' },
      { to: '/ambaji-account/records', label: 'All Records', tag: '03' }
    ]
  },
  {
    to: '/seoc-account',
    label: 'SEOC Account',
    tag: 'SO',
    adminOnly: true,
    children: [
      { to: '/seoc-account', label: 'Overview', tag: '01', end: true },
      { to: '/seoc-account/add', label: 'Add Entry', tag: '02' },
      { to: '/seoc-account/records', label: 'All Records', tag: '03' }
    ]
  },
  {
    to: '/settings',
    label: 'Settings',
    tag: 'ST',
    children: [
      { to: '/settings/users', label: 'Users', tag: '01', adminOnly: true },
      { to: '/settings/profile', label: 'My Login', tag: '02' },
      { to: '/settings/backup', label: 'Backup & Restore', tag: '03', adminOnly: true },
      { to: '/settings/log', label: 'Activity Log', tag: '04', superAdminOnly: true }
    ]
  }
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { session, logout } = useAuth();
  const location = useLocation();
  // The super admin can see everything an admin can, plus the Activity Log.
  const isAdmin = session.role === 'admin' || session.role === 'superadmin';
  const isSuperAdmin = session.role === 'superadmin';
  const visibleItems = NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-mobile-head">
        <span>Menu</span>
        <button type="button" className="sidebar-close-btn" aria-label="Close menu" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="brand">
        <div className="brand-mark">
          <img src="/logo.png" alt="Show Humanity Trust logo" />
        </div>
        <h1>CareTrack</h1>
        <p>Internal Tools</p>
      </div>
      <nav>
        {visibleItems.map((item) => {
          const isActiveModule = location.pathname.startsWith(item.to);
          const visibleChildren = item.children.filter((child) => {
            if (child.superAdminOnly) return isSuperAdmin;
            return isAdmin || !child.adminOnly;
          });
          return (
            <div className="nav-group" key={item.to}>
              <NavLink to={item.to} className={() => (isActiveModule ? 'active' : '')} onClick={onClose}>
                <span className="tag">{item.tag}</span>
                {item.label}
              </NavLink>
              {isActiveModule && visibleChildren.length > 0 && (
                <div className="nav-subgroup">
                  {visibleChildren.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.end}
                      className={({ isActive }) => (isActive ? 'active' : '')}
                      onClick={onClose}
                    >
                      <span className="tag">{child.tag}</span>
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="sidebar-user">
          <div className="sidebar-user-name">
            <span className="sidebar-user-avatar" aria-hidden="true">
              {session.username.slice(0, 2)}
            </span>
            <span className="sidebar-user-meta">
              <span className="sidebar-user-label">Signed in as</span>
              <span className="sidebar-user-value" title={session.username}>
                {session.username}
              </span>
            </span>
          </div>
          <button type="button" className="logout-link" onClick={logout}>
            <LogOut />
            Sign out
          </button>
        </div>
        <div className="sidebar-credits">
          <span>Created by Amish Patel</span>
          <span className="credits-help">
            for help &amp; query{' '}
            <a href="tel:+917359354515" className="credits-call-btn" aria-label="Call for help and support" title="Call for help">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </a>
          </span>
        </div>
      </div>
    </aside>
  );
}
