import { getRoleDashboardPath } from '../routes/guards';

/**
 * Validates and resolves the post-login destination URL for an authenticated profile.
 * - Enforces role-based access rules
 * - Rejects external, malformed, or protocol-relative URLs
 * - Disallows returning to auth routes or root ("/", "/login", "/signup", "/auth/callback", "/reset-password")
 * - Falls back to role dashboard if returnTo is absent, disallowed, or unsafe
 *
 * @param {object} profile - User profile from /api/auth/me containing .role
 * @param {string|object} [returnTo] - Desired destination path or location object
 * @returns {string} - Clean, authorized internal path
 */
export function resolvePostLoginPath(profile, returnTo) {
  const role = profile?.role;
  const defaultPath = getRoleDashboardPath(role);

  let rawPath = returnTo;
  if (rawPath && typeof rawPath === 'object' && rawPath.pathname) {
    rawPath = rawPath.pathname + (rawPath.search || '') + (rawPath.hash || '');
  }

  if (!rawPath || typeof rawPath !== 'string') {
    return defaultPath;
  }

  const trimmed = rawPath.trim();

  // Validate internal path: must start with exactly one '/', not '//', no protocol, no backslash
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
  ) {
    return defaultPath;
  }

  const cleanPath = trimmed.split('?')[0].split('#')[0];

  // Banned paths: root and auth routes must never be the post-login destination
  const banned = ['/', '/login', '/signup', '/auth/callback', '/reset-password'];
  if (banned.includes(cleanPath)) {
    return defaultPath;
  }

  // Role permissions check against route guards
  // ADMIN has access to all internal sections
  if (role === 'ADMIN') {
    return trimmed;
  }

  // OWNER paths only for OWNER and ADMIN
  if (cleanPath.startsWith('/owner')) {
    return role === 'OWNER' ? trimmed : defaultPath;
  }

  // PROVIDER paths only for PROVIDER and ADMIN
  if (cleanPath.startsWith('/provider')) {
    return role === 'PROVIDER' ? trimmed : defaultPath;
  }

  // ADMIN paths only for ADMIN
  if (cleanPath.startsWith('/admin')) {
    return defaultPath;
  }

  // Customer booking and favorites paths only for CUSTOMER
  if (cleanPath.startsWith('/bookings') || cleanPath.startsWith('/favorites')) {
    return role === 'CUSTOMER' ? trimmed : defaultPath;
  }

  // Other internal paths (e.g. /explore, /spaces/:id, /account/:sub)
  return trimmed;
}
