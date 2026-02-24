import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar, MobileTopBar } from './Sidebar';

/**
 * AppLayout wraps all protected routes.
 * Renders the persistent sidebar + a scrollable main content area.
 */
const AppLayout = () => {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar (desktop: fixed left, mobile: Sheet overlay) */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile hamburger bar */}
        <MobileTopBar />

        {/* Page content via nested route Outlet */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
