import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Calendar, Heart, User, LogOut } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { getRoleDashboardPath } from '../../routes/guards';
import { resolvePostLoginPath } from '../../lib/postLoginRedirect';
import { Avatar } from '../ui/Avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '../ui/DropdownMenu';
import { PageTransition } from '../../lib/motion';
import { useHeaderScrollShadow } from '../../lib/scrollMotion';
import { cn } from '../../lib/utils';

/**
 * Clean, solid Monogram Logo (Rule 8 compliant: zero decorative rotating ring).
 */
export function BrandMonogram({ className = 'w-9 h-9' }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <div className={cn('flex items-center justify-center shrink-0 rounded-xl bg-primary shadow-warm-xs', className)}>
        <span className="font-editorial text-sm font-normal text-white leading-none tracking-tight">
          N
        </span>
      </div>
      <span className="font-editorial text-2xl font-light tracking-tight text-ink leading-none">
        Nexora
      </span>
    </div>
  );
}

// Backward compatible export for existing components
export const BrandWordmark = BrandMonogram;

/**
 * PublicLayout:
 * - Public top bar contains ONLY the Nexora wordmark on the left (links to "/").
 *   No links, no buttons, no menu button, no Log in, no Sign up, no Explore, no How it works, no Design System for guests.
 *   Solid cream background, shadow after scroll.
 * - When a user IS logged in, show the account menu on the right.
 * - Rebuilt 3-column footer (Customers, Owners, Service providers) with Log in and Create account links.
 */
export function PublicLayout() {
  const { isAuthenticated, role, user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isScrolled = useHeaderScrollShadow(10);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col selection:bg-amber/20 selection:text-ink">
      {/* Top Navbar */}
      <header
        className={cn(
          'sticky top-0 z-30 bg-cream border-b border-border transition-shadow duration-200',
          isScrolled ? 'shadow-warm-sm' : ''
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Monogram & Wordmark (Links to "/" for guests, role home for signed-in users) */}
          <div className="flex items-center justify-start">
            <Link
              to={isAuthenticated ? resolvePostLoginPath(profile) : '/'}
              className="inline-block focus-ring rounded-xl"
            >
              <BrandMonogram />
            </Link>
          </div>

          {/* Right Area: ONLY shown when user IS logged in */}
          {isAuthenticated && (
            <div className="flex items-center justify-end">
              <DropdownMenu
                trigger={
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="flex items-center gap-2.5 py-1.5 px-3 rounded-xl border border-border bg-card hover:bg-sand transition-all focus-ring shadow-warm-xs"
                  >
                    <Avatar
                      name={profile?.name || user?.email || 'User'}
                      src={profile?.avatar_url}
                      size="sm"
                    />
                    <span className="text-xs font-semibold text-ink max-w-[120px] truncate">
                      {profile?.name || user?.email?.split('@')[0] || 'Account'}
                    </span>
                  </button>
                }
              >
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-semibold text-ink truncate">
                    {profile?.name || 'Member'}
                  </p>
                  <p className="text-xs text-body uppercase tracking-wider">{role || 'CUSTOMER'}</p>
                </div>
                <DropdownMenuItem
                  icon={<Compass className="w-4 h-4" />}
                  onClick={() => navigate(getRoleDashboardPath(role))}
                >
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<Calendar className="w-4 h-4" />}
                  onClick={() => navigate('/bookings')}
                >
                  My Bookings
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<Heart className="w-4 h-4" />}
                  onClick={() => navigate('/favorites')}
                >
                  Saved spaces
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<User className="w-4 h-4" />}
                  onClick={() => navigate('/account/profile')}
                >
                  Profile & Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={<LogOut className="w-4 h-4" />}
                  danger
                  onClick={signOut}
                >
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenu>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        <PageTransition key={location.pathname}>
          <Outlet />
        </PageTransition>
      </main>

      {/* Oliver Smith Multi-Column Footer with Hairline Dividers & Subtle Brand Watermark */}
      <footer className="border-t border-border bg-sand relative overflow-hidden">
        {/* Top Newsletter & Intro Bar */}
        <div className="border-b border-border py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="max-w-md">
                <span className="text-[11px] font-mono tracking-widest text-primary uppercase font-semibold">
                  NEXORA HOSPITALITY GROUP
                </span>
                <p className="text-sm text-body mt-2 leading-relaxed">
                  Real estate workspace booking and property management. Simple, transparent reservations and verified facilities across India.
                </p>
              </div>

              {/* Newsletter subscribe */}
              <div className="w-full md:w-auto">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                  className="flex items-center gap-2 max-w-md"
                >
                  <input
                    type="email"
                    placeholder="name@email.com"
                    className="bg-card border border-border rounded-lg px-4 py-2.5 text-xs text-ink placeholder:text-body/60 focus-ring w-64"
                    aria-label="Email address for updates"
                  />
                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors focus-ring"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Main Footer Links Columns */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          {isAuthenticated ? (
            /* Signed in footer: show only the column that matches their role */
            <div className="mb-12 max-w-sm">
              <h4 className="font-editorial text-lg font-normal text-ink mb-3">
                {role === 'OWNER'
                  ? 'Owners'
                  : role === 'PROVIDER'
                  ? 'Service providers'
                  : role === 'ADMIN'
                  ? 'Administration'
                  : 'Customers'}
              </h4>
              <ul className="space-y-2 text-sm text-body">
                <li>
                  <Link
                    to={resolvePostLoginPath(profile)}
                    className="hover:text-primary-hover transition-colors font-medium text-ink"
                  >
                    Go to my dashboard
                  </Link>
                </li>
              </ul>
            </div>
          ) : (
            /* Guest footer: 3 columns required by tests */
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border border-y border-border py-8 mb-12">
              {/* Column 1: Customers */}
              <div className="py-6 md:py-0 md:px-8 first:pt-0 md:first:pl-0">
                <h4 className="font-editorial text-lg font-normal text-ink mb-3">
                  Customers
                </h4>
                <ul className="space-y-2.5 text-sm text-body">
                  <li>
                    <Link to="/login?role=customer" className="hover:text-primary-hover transition-colors">
                      Log in
                    </Link>
                  </li>
                  <li>
                    <Link to="/signup?role=customer" className="hover:text-primary-hover transition-colors">
                      Create account
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Column 2: Owners */}
              <div className="py-6 md:py-0 md:px-8">
                <h4 className="font-editorial text-lg font-normal text-ink mb-3">
                  Owners
                </h4>
                <ul className="space-y-2.5 text-sm text-body">
                  <li>
                    <Link to="/login?role=owner" className="hover:text-primary-hover transition-colors">
                      Log in
                    </Link>
                  </li>
                  <li>
                    <Link to="/signup?role=owner" className="hover:text-primary-hover transition-colors">
                      Create account
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Column 3: Service providers */}
              <div className="py-6 md:py-0 md:px-8 last:pb-0 md:last:pr-0">
                <h4 className="font-editorial text-lg font-normal text-ink mb-3">
                  Service providers
                </h4>
                <ul className="space-y-2.5 text-sm text-body">
                  <li>
                    <Link to="/login?role=provider" className="hover:text-primary-hover transition-colors">
                      Log in
                    </Link>
                  </li>
                  <li>
                    <Link to="/signup?role=provider" className="hover:text-primary-hover transition-colors">
                      Create account
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Small print */}
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-body gap-4 relative z-10">
            <p>© {new Date().getFullYear()} Nexora Hospitality Group. All rights reserved.</p>
            <p>Kolkata Standard Time (IST) • Payments in INR (₹)</p>
          </div>

          {/* Oliver Smith signature massive watermark across bottom of footer */}
          <div
            aria-hidden="true"
            className="select-none pointer-events-none mt-12 text-center overflow-hidden"
          >
            <span className="font-editorial text-[80px] sm:text-[140px] md:text-[200px] font-bold tracking-tight text-ink/[0.04] leading-none block uppercase">
              NEXORA
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
