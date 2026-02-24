import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Package,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppContext } from '../context/AppContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';

// --------------------------------------------------------
// Nav items definition
// --------------------------------------------------------

const useNavItems = () => {
  const { lastSupplierId } = useAppContext();

  return [
    {
      key: 'product-select',
      label: 'Products',
      icon: Package,
      path: '/product-select',
      matchPaths: ['/product-select'],
    },
    {
      key: 'data-entry',
      label: 'Suppliers Data Entry',
      icon: Users,
      path: lastSupplierId ? `/supplier/${lastSupplierId}` : '/suppliers',
      matchPaths: ['/suppliers', '/supplier/'],
      excludePaths: ['/dashboard'],
    },
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: lastSupplierId
        ? `/supplier/${lastSupplierId}/dashboard`
        : '/suppliers',
      matchPaths: ['/dashboard'],
    },
    {
      key: 'history',
      label: 'History of Logs',
      icon: CalendarDays,
      path: '/history',
      matchPaths: ['/history'],
    },
    {
      key: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      path: '/analytics',
      matchPaths: ['/analytics'],
    },
  ];
};

// --------------------------------------------------------
// Check if a nav item is active
// --------------------------------------------------------
function isActive(item, pathname) {
  // Check excludes first
  if (item.excludePaths?.some((p) => pathname.includes(p))) return false;
  return item.matchPaths.some((p) => pathname.startsWith(p) || pathname.includes(p));
}

// --------------------------------------------------------
// Sidebar content (shared between desktop & mobile)
// --------------------------------------------------------
const SidebarContent = ({ collapsed, onToggle, onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = useNavItems();
  const { lastSupplierName } = useAppContext();

  const handleNav = (path) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-heading text-sm font-bold">
          C
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-heading font-bold tracking-wide text-sidebar-foreground truncate">
              CHICKEN ERP
            </span>
            {lastSupplierName && (
              <span className="text-[11px] text-sidebar-muted truncate">
                {lastSupplierName}
              </span>
            )}
          </div>
        )}
        {/* Desktop collapse toggle */}
        {onToggle && (
          <button
            onClick={onToggle}
            className="ml-auto hidden md:flex h-7 w-7 items-center justify-center rounded-md text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-hover transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item, location.pathname);
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              onClick={() => handleNav(item.path)}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-hover'
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  active ? 'text-primary' : ''
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border">
        {!collapsed && (
          <p className="text-[10px] text-sidebar-muted tracking-wider uppercase">
            Chicken ERP v1.0
          </p>
        )}
      </div>
    </div>
  );
};

// --------------------------------------------------------
// Desktop Sidebar
// --------------------------------------------------------
const DesktopSidebar = ({ collapsed, onToggle }) => {
  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen sticky top-0 bg-sidebar border-r border-sidebar-border transition-all duration-300 z-30',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      <SidebarContent collapsed={collapsed} onToggle={onToggle} />
    </aside>
  );
};

// --------------------------------------------------------
// Mobile Sidebar (Sheet)
// --------------------------------------------------------
const MobileSidebar = ({ open, onOpenChange }) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 w-[260px] bg-sidebar border-sidebar-border">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <SidebarContent
          collapsed={false}
          onNavigate={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
};

// --------------------------------------------------------
// Mobile top bar (hamburger trigger)
// --------------------------------------------------------
export const MobileTopBar = () => {
  const { sidebarOpen, setSidebarOpen } = useAppContext();

  return (
    <div className="flex md:hidden items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-20">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      <span className="font-heading text-sm font-bold tracking-wide">CHICKEN ERP</span>
    </div>
  );
};

// --------------------------------------------------------
// Composed Sidebar export
// --------------------------------------------------------
export const Sidebar = () => {
  const { sidebarOpen, setSidebarOpen } = useAppContext();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <>
      <DesktopSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />
      <MobileSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
    </>
  );
};

export default Sidebar;
