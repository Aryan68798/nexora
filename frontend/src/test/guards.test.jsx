import { describe, it, expect } from 'vitest';
import { getRoleDashboardPath } from '../routes/guards';

describe('getRoleDashboardPath helper', () => {
  it('returns /owner/dashboard for OWNER', () => {
    expect(getRoleDashboardPath('OWNER')).toBe('/owner/dashboard');
  });

  it('returns /provider/jobs for PROVIDER', () => {
    expect(getRoleDashboardPath('PROVIDER')).toBe('/provider/jobs');
  });

  it('returns /admin for ADMIN', () => {
    expect(getRoleDashboardPath('ADMIN')).toBe('/admin');
  });

  it('returns /explore for CUSTOMER or unknown role', () => {
    expect(getRoleDashboardPath('CUSTOMER')).toBe('/explore');
    expect(getRoleDashboardPath(undefined)).toBe('/explore');
    expect(getRoleDashboardPath(null)).toBe('/explore');
    expect(getRoleDashboardPath('GUEST')).toBe('/explore');
  });
});
