import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu automatically whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell">
      <header className="mobile-header">
        <button
          type="button"
          className="hamburger-btn"
          aria-label="Open menu"
          aria-expanded={navOpen}
          onClick={() => setNavOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="mobile-header-brand">
          <img src="/logo.png" alt="" />
          <span>CareTrack</span>
        </div>
      </header>

      {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}

      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
