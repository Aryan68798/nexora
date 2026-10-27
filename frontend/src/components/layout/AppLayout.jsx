import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Compass,
  Calendar,
  Building,
  Wrench,
  DollarSign,
  ClipboardCheck,
  Shield,
  Bell,
  Heart,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { api } from '../../api/client';
import { BrandWordmark } from './PublicLayout';
import { Avatar } from '../ui/Avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '../ui/DropdownMenu';
import { PageTransition } from '../../lib/motion';
import { cn } from '../../lib/utils';

/**
 * Role-based navigation configs
 */
const ROLE_NAV_ITEMS = {
  CUSTOMER: [
    { label: 'Explore', path: '/explore', icon: Compass },
    { label: 'My Bookings', path: '/bookings', icon: Calendar },
    { label: 'Favorites', path: '/favorites', icon: Heart },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'My Profile', path: '/account/profile', icon: User },
  ],
  OWNER: [
    { label: 'Dashboard', path: '/owner/dashboard', icon: Compass },
    { label: 'Properties', path: '/owner/properties', icon: Building },
    { label: 'Bookings', path: '/owner/bookings', icon: Calendar },
    { label: 'Maintenance', path: '/owner/maintenance', icon: Wrench },
    { label: 'Expenses', path: '/owner/expenses', icon: DollarSign },
    { label: 'Inspections', path: '/owner/inspections', icon: ClipboardCheck },
    { label: 'Notifications', path: '/notifications', icon: Bell },
  ],
  PROVIDER: [
    { label: 'Job Board', path: '/provider/jobs', icon: Wrench },
    { label: 'My Schedule', path: '/provider/schedule', icon: Calendar },
    { label: 'Reviews', path: '/provider/reviews', icon: ClipboardCheck },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Profile', path: '/account/profile', icon: User },
  ],
  ADMIN: [
    { label: 'Overview', path: '/admin', icon: Shield },
    { label: 'Verifications', path: '/admin/verifications', icon: ClipboardCheck },
    { label: 'Properties', path: '/admin/properties', icon: Building },
    { label: 'Users', path: '/admin/users', icon: User },
    { label: 'Notifications', path: '/notifications', icon: Bell },
  ],
};

/**
 * AppLayout: Shell for authenticated users with desktop sidebar and mobile bottom bar
 * Solid cream background header with soft shadow on scroll (zero translucent blur).
 */
export function AppLayout() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const navItems = ROLE_NAV_ITEMS[role] || ROLE_NAV_ITEMS.CUSTOMER;

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 10);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Poll unread notification count every 30 seconds
  useEffect(() => {
    let isMounted = true;

    async function checkNotifications() {
      try {
        const res = await api.get('/api/notifications/unread-count');
        if (isMounted && res && typeof res.count === 'number') {
          setUnreadCount(res.count);
        }
      } catch {
        // Silently ignore background polling errors
      }
    }

    checkNotifications();
    const intervalId = setInterval(checkNotifications, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Poll pending bookings count for owners every 60 seconds
  useEffect(() => {
    if (role !== 'OWNER') return;
    let isMounted = true;

    async function checkPendingBookings() {
      try {
        const res = await api.get('/api/owner/bookings?status=PENDING&pageSize=1');
        const count = res?.meta?.totalCount ?? res?.meta?.total;
        if (isMounted && typeof count === 'number') {
          setPendingBookingsCount(count);
        }
      } catch {
        // Silently ignore background polling errors
      }
    }

    checkPendingBookings();
    const intervalId = setInterval(checkPendingBookings, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [role]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-cream flex text-ink">
      {/* Desktop Collapsible Left Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border bg-cream transition-all duration-300 z-30',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Sidebar Header */}
        <div className="h-18 px-5 border-b border-border flex items-center justify-between">
          {!collapsed ? (
            <NavLink to="/" className="focus-ring rounded-lg">
              <BrandWordmark />
            </NavLink>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-serif font-bold mx-auto">
              N
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-body hover:bg-sand focus-ring"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto" aria-label="Sidebar Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isNotifications = item.path === '/notifications';
            const isOwnerBookings = item.path === '/owner/bookings';

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center min-h-[44px] px-3.5 rounded-xl text-sm font-medium transition-all group focus-ring relative',
                    isActive
                      ? 'bg-primary text-white shadow-warm-xs font-semibold'
                      : 'text-body hover:bg-sand hover:text-ink'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'w-5 h-5 flex-shrink-0 transition-colors',
                        isActive ? 'text-white' : 'text-body group-hover:text-primary'
                      )}
                    />
                    {!collapsed && <span className="ml-3 truncate">{item.label}</span>}

                    {/* Unread notifications badge */}
                    {isNotifications && unreadCount > 0 && (
                      <span
                        className={cn(
                          'ml-auto text-xs px-2 py-0.5 rounded-lg font-bold',
                          isActive ? 'bg-white text-primary' : 'bg-primary text-white',
                          collapsed && 'absolute top-2 right-2 w-2 h-2 p-0 rounded-full'
                        )}
                        data-indicator="true"
                      >
                        {!collapsed && unreadCount}
                      </span>
                    )}

                    {/* Pending owner bookings badge */}
                    {isOwnerBookings && pendingBookingsCount > 0 && (
                      <span
                        className={cn(
                          'ml-auto text-xs px-2 py-0.5 rounded-lg font-bold',
                          isActive ? 'bg-white text-primary' : 'bg-primary text-white',
                          collapsed && 'absolute top-2 right-2 w-2 h-2 p-0 rounded-full'
                        )}
                        data-indicator="true"
                        aria-label={`${pendingBookingsCount} pending booking requests`}
                      >
                        {!collapsed && pendingBookingsCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar User Footer */}
        <div className="p-3 border-t border-border">
          <div
            className={cn(
              'flex items-center gap-3 p-2 rounded-xl bg-sand',
              collapsed && 'justify-center p-1.5'
            )}
          >
            <Avatar
              name={profile?.name || 'User'}
              src={profile?.avatar_url}
              size="sm"
            />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">
                  {profile?.name || 'Member'}
                </p>
                <p className="text-[11px] font-medium tracking-wider text-primary uppercase mt-0.5">
                  {role}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Application Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 bg-cream">
        {/* Top Header Bar: Solid cream with soft shadow on scroll (zero blur) */}
        <header
          className={cn(
            'sticky top-0 z-20 h-16 border-b border-border bg-cream px-4 sm:px-6 flex items-center justify-between transition-shadow duration-200',
            isScrolled ? 'shadow-warm-sm' : ''
          )}
        >
          <div className="flex items-center gap-3">
            {/* Mobile wordmark */}
            <div className="md:hidden">
              <NavLink to="/">
                <BrandWordmark className="h-6 w-auto" />
              </NavLink>
            </div>
            <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-sand text-ink border border-border">
              Workspace &bull; {role}
            </span>
          </div>

          {/* Right Header Icons */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <NavLink
              to="/notifications"
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-body hover:bg-sand focus-ring"
              aria-label={`Notifications, ${unreadCount} unread`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary text-white text-2xs font-bold flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>

            {/* Profile Dropdown */}
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-2 p-1 rounded-lg focus-ring hover:bg-sand"
                  aria-label="User menu"
                >
                  <Avatar
                    name={profile?.name || 'User'}
                    src={profile?.avatar_url}
                    size="sm"
                  />
                </button>
              }
            >
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-semibold text-ink">{profile?.name}</p>
                <p className="text-xs text-body">{role}</p>
              </div>
              <DropdownMenuItem onClick={() => navigate('/account/profile')}>
                <User className="w-4 h-4 mr-2" />
                Profile & Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-danger hover:bg-danger/10">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar with Safe Area */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 pb-safe bg-cream border-t border-border flex items-center justify-around px-2 z-40 shadow-warm-lg"
        aria-label="Mobile Navigation"
      >
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isNotifications = item.path === '/notifications';
          const isOwnerBookings = item.path === '/owner/bookings';

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 rounded-lg text-xs font-medium transition-colors relative',
                  isActive ? 'text-primary font-semibold' : 'text-body hover:text-ink'
                )
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="truncate max-w-[70px] text-2xs">{item.label}</span>
              {isNotifications && unreadCount > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-primary" />
              )}
              {isOwnerBookings && pendingBookingsCount > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-primary" />
              )}
            </NavLink>
          );
        })}

        {/* More drawer toggle button if > 4 items */}
        {navItems.length > 4 && (
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 rounded-lg text-xs text-body hover:text-ink"
            aria-label="More navigation links"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-2xs">More</span>
          </button>
        )}
      </nav>

      {/* Mobile Drawer for extra nav links */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex flex-col justify-end">
          <div className="bg-cream rounded-t-2xl p-6 border-t border-border space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-serif font-bold text-lg text-ink">Navigation</h3>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-lg text-body hover:bg-sand"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileDrawerOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-sand hover:bg-border/60 text-sm font-medium text-ink"
                  >
                    <Icon className="w-5 h-5 text-primary" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
