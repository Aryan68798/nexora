import { describe, it, expect } from 'vitest';
import { resolvePostLoginPath } from '../lib/postLoginRedirect';

describe('resolvePostLoginPath', () => {
  it('returns role defaults when returnTo is absent or empty', () => {
    expect(resolvePostLoginPath({ role: 'OWNER' })).toBe('/owner/dashboard');
    expect(resolvePostLoginPath({ role: 'PROVIDER' })).toBe('/provider/jobs');
    expect(resolvePostLoginPath({ role: 'ADMIN' })).toBe('/admin');
    expect(resolvePostLoginPath({ role: 'CUSTOMER' })).toBe('/explore');
    expect(resolvePostLoginPath(null)).toBe('/explore');
    expect(resolvePostLoginPath({})).toBe('/explore');
  });

  it('rejects banned paths and falls back to role dashboard', () => {
    const owner = { role: 'OWNER' };
    expect(resolvePostLoginPath(owner, '/')).toBe('/owner/dashboard');
    expect(resolvePostLoginPath(owner, '/login')).toBe('/owner/dashboard');
    expect(resolvePostLoginPath(owner, '/signup')).toBe('/owner/dashboard');
    expect(resolvePostLoginPath(owner, '/auth/callback')).toBe('/owner/dashboard');
    expect(resolvePostLoginPath(owner, '/reset-password')).toBe('/owner/dashboard');
    expect(resolvePostLoginPath(owner, '/?role=owner')).toBe('/owner/dashboard');
  });

  it('rejects external and protocol-relative URLs', () => {
    const cust = { role: 'CUSTOMER' };
    expect(resolvePostLoginPath(cust, 'https://malicious.com')).toBe('/explore');
    expect(resolvePostLoginPath(cust, '//malicious.com')).toBe('/explore');
    expect(resolvePostLoginPath(cust, 'javascript:alert(1)')).toBe('/explore');
    expect(resolvePostLoginPath(cust, '\\evil.com')).toBe('/explore');
  });

  it('enforces role authorization on sensitive paths', () => {
    const customer = { role: 'CUSTOMER' };
    const owner = { role: 'OWNER' };
    const provider = { role: 'PROVIDER' };
    const admin = { role: 'ADMIN' };

    // Customers cannot access owner or provider paths
    expect(resolvePostLoginPath(customer, '/owner/dashboard')).toBe('/explore');
    expect(resolvePostLoginPath(customer, '/provider/jobs')).toBe('/explore');
    expect(resolvePostLoginPath(customer, '/admin')).toBe('/explore');
    expect(resolvePostLoginPath(customer, '/spaces/space-1')).toBe('/spaces/space-1');

    // Owners can access owner paths but not provider or admin
    expect(resolvePostLoginPath(owner, '/owner/properties')).toBe('/owner/properties');
    expect(resolvePostLoginPath(owner, '/provider/jobs')).toBe('/owner/dashboard');
    expect(resolvePostLoginPath(owner, '/admin/users')).toBe('/owner/dashboard');

    // Providers can access provider paths but not owner or admin
    expect(resolvePostLoginPath(provider, '/provider/schedule')).toBe('/provider/schedule');
    expect(resolvePostLoginPath(provider, '/owner/dashboard')).toBe('/provider/jobs');
    expect(resolvePostLoginPath(provider, '/admin')).toBe('/provider/jobs');

    // Admin can access everything
    expect(resolvePostLoginPath(admin, '/owner/dashboard')).toBe('/owner/dashboard');
    expect(resolvePostLoginPath(admin, '/provider/jobs')).toBe('/provider/jobs');
    expect(resolvePostLoginPath(admin, '/admin/users')).toBe('/admin/users');
  });

  it('handles React Router location objects with pathname', () => {
    const owner = { role: 'OWNER' };
    expect(resolvePostLoginPath(owner, { pathname: '/owner/properties', search: '?status=active' })).toBe(
      '/owner/properties?status=active'
    );
    expect(resolvePostLoginPath(owner, { pathname: '/' })).toBe('/owner/dashboard');
  });
});
