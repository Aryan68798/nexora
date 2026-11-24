import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { resolvePostLoginPath } from '../lib/postLoginRedirect';

/**
 * Helper to determine default home path based on user role
 * @param {string} role
 * @returns {string}
 */
export function getRoleDashboardPath(role) {
  switch (role) {
    case 'OWNER':
      return '/owner/dashboard';
    case 'PROVIDER':
      return '/provider/jobs';
    case 'ADMIN':
      return '/admin';
    case 'CUSTOMER':
    default:
      return '/explore';
  }
}

/**
 * Account Disabled screen
 */
export function AccountDisabledView() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl p-8 shadow-warm-md border border-border text-center">
        <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center text-danger mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-ink mb-2">Account Deactivated</h2>
        <p className="text-body text-sm mb-6 leading-relaxed">
          Your Nexora account has been deactivated or disabled by an administrator.
          If you believe this is an error, please contact support.
        </p>
        <Button variant="secondary" onClick={signOut} leftIcon={<LogOut className="w-4 h-4" />}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}

/**
 * 403 Forbidden screen
 */
export function ForbiddenView({ allowedRoles = [] }) {
  const { role, signOut } = useAuth();
  const homePath = getRoleDashboardPath(role);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl p-8 shadow-warm-md border border-border text-center">
        <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center text-ink mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-ink mb-2">Access Restricted</h2>
        <p className="text-body text-sm mb-6 leading-relaxed">
          You don&apos;t have permission to access this area. This section requires{' '}
          <span className="font-semibold text-ink">
            {allowedRoles.join(' or ')}
          </span>{' '}
          privileges, but your role is <span className="font-semibold text-primary-hover">{role}</span>.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to={homePath}>
            <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Home
            </Button>
          </Link>
          <Button variant="ghost" onClick={signOut}>
            Sign In as Different User
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * ProtectedRoute: Requires authenticated user and active profile.
 * Redirects to /login if unauthenticated.
 * Shows AccountDisabledView if deactivated.
 */
export function ProtectedRoute({ children }) {
  const { session, profile, status, loading, isDisabled } = useAuth();
  const location = useLocation();

  // Never redirect while loading or checking profile
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Spinner size="lg" label="Checking authentication..." />
      </div>
    );
  }

  if (isDisabled) {
    return <AccountDisabledView />;
  }

  if (!session || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/**
 * RoleRoute: Enforces specific roles (e.g. ['OWNER', 'ADMIN']).
 * Shows ForbiddenView if role not matched.
 */
export function RoleRoute({ allowedRoles = [], children }) {
  const { role, status, loading } = useAuth();

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Spinner size="lg" label="Verifying access..." />
      </div>
    );
  }

  if (!allowedRoles.includes(role)) {
    return <ForbiddenView allowedRoles={allowedRoles} />;
  }

  return children;
}

/**
 * GuestRoute: For login/signup pages.
 * Redirects already-authenticated users to their role-appropriate dashboard.
 */
export function GuestRoute({ children }) {
  const { session, profile, status, loading } = useAuth();
  const location = useLocation();

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Spinner size="lg" label="Loading..." />
      </div>
    );
  }

  if (session && profile && profile.is_active !== false) {
    const dest = resolvePostLoginPath(profile, location.state?.from);
    return <Navigate to={dest} replace />;
  }

  return children;
}
