import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { supabase } from '../src/lib/supabase.js';
import { prisma } from '../src/lib/prisma.js';

vi.mock('../src/lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    profiles: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    bookings: {
      count: vi.fn(),
    },
    payments: {
      count: vi.fn(),
    },
    favorites: {
      count: vi.fn(),
    },
    service_categories: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  },
}));

describe('Authentication & Role Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 UNAUTHORIZED when Authorization header is missing', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 UNAUTHORIZED when token is invalid or expired', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-123');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 403 ACCOUNT_DISABLED when profile isActive is false', async () => {
    const token = 'disabled-user-token';
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u-disabled', email: 'disabled@test.com' } },
      error: null,
    });

    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: 'u-disabled',
      email: 'disabled@test.com',
      role: 'CUSTOMER',
      name: 'Disabled User',
      is_active: false,
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('should return 403 FORBIDDEN when user has wrong role', async () => {
    const token = 'customer-token';
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u-cust', email: 'cust@test.com' } },
      error: null,
    });

    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: 'u-cust',
      email: 'cust@test.com',
      role: 'CUSTOMER',
      name: 'Customer User',
      is_active: true,
    });

    // /api/admin/users requires ADMIN role
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should allow ADMIN to access protected admin routes', async () => {
    const token = 'admin-token-xyz';
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u-admin', email: 'admin@test.com' } },
      error: null,
    });

    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: 'u-admin',
      email: 'admin@test.com',
      role: 'ADMIN',
      name: 'Admin User',
      is_active: true,
    });

    prisma.profiles.count.mockResolvedValueOnce(1);
    prisma.profiles.findMany.mockResolvedValueOnce([
      {
        id: 'u-admin',
        email: 'admin@test.com',
        role: 'ADMIN',
        name: 'Admin User',
        is_active: true,
        created_at: new Date(),
        service_providers: null,
      },
    ]);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('PATCH /api/auth/me should reject role changes with 400 VALIDATION_ERROR', async () => {
    const token = 'customer-patch-token';
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u-cust-2', email: 'cust2@test.com' } },
      error: null,
    });

    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: 'u-cust-2',
      email: 'cust2@test.com',
      role: 'CUSTOMER',
      name: 'Customer 2',
      is_active: true,
    });

    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        role: 'ADMIN', // forbidden property
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  describe('POST /api/auth/me/role', () => {
    it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/auth/me/role')
        .send({ role: 'OWNER' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects ADMIN role with 400 VALIDATION_ERROR', async () => {
      const token = 'cust-token';
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'u-1', email: 'cust@test.com' } },
        error: null,
      });

      prisma.profiles.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        email: 'cust@test.com',
        role: 'CUSTOMER',
        name: 'Cust',
        is_active: true,
      });

      const res = await request(app)
        .post('/api/auth/me/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects unknown fields with 400 VALIDATION_ERROR (Zod strict)', async () => {
      const token = 'cust-token';
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'u-1', email: 'cust@test.com' } },
        error: null,
      });

      prisma.profiles.findUnique.mockResolvedValueOnce({
        id: 'u-1',
        email: 'cust@test.com',
        role: 'CUSTOMER',
        name: 'Cust',
        is_active: true,
      });

      const res = await request(app)
        .post('/api/auth/me/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'OWNER', extraField: 'disallowed' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('blocks non-CUSTOMER role with 409 ROLE_CHANGE_NOT_ALLOWED', async () => {
      const token = 'owner-token';
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'u-owner', email: 'owner@test.com' } },
        error: null,
      });

      prisma.profiles.findUnique.mockResolvedValueOnce({
        id: 'u-owner',
        email: 'owner@test.com',
        role: 'OWNER',
        name: 'Owner',
        is_active: true,
      });

      const res = await request(app)
        .post('/api/auth/me/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'PROVIDER' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROLE_CHANGE_NOT_ALLOWED');
    });

    it('blocks user with existing bookings with 409 ROLE_CHANGE_NOT_ALLOWED', async () => {
      const token = 'cust-token';
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'u-cust-active', email: 'active@test.com' } },
        error: null,
      });

      prisma.profiles.findUnique.mockResolvedValueOnce({
        id: 'u-cust-active',
        email: 'active@test.com',
        role: 'CUSTOMER',
        name: 'Active Cust',
        is_active: true,
      });

      prisma.bookings.count.mockResolvedValueOnce(1); // has 1 booking
      prisma.payments.count.mockResolvedValueOnce(0);
      prisma.favorites.count.mockResolvedValueOnce(0);

      const res = await request(app)
        .post('/api/auth/me/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'OWNER' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROLE_CHANGE_NOT_ALLOWED');
    });

    it('allows CUSTOMER with zero bookings, payments and favorites to change role to OWNER or PROVIDER', async () => {
      const token = 'cust-clean-token';
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'u-clean', email: 'clean@test.com' } },
        error: null,
      });

      prisma.profiles.findUnique.mockResolvedValue({
        id: 'u-clean',
        email: 'clean@test.com',
        role: 'CUSTOMER',
        name: 'Clean Cust',
        is_active: true,
      });

      prisma.bookings.count.mockResolvedValueOnce(0);
      prisma.payments.count.mockResolvedValueOnce(0);
      prisma.favorites.count.mockResolvedValueOnce(0);

      prisma.profiles.update.mockResolvedValueOnce({
        id: 'u-clean',
        email: 'clean@test.com',
        role: 'OWNER',
        name: 'Clean Cust',
        is_active: true,
        service_providers: null,
      });

      const res = await request(app)
        .post('/api/auth/me/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'OWNER' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('OWNER');
    });
  });
});
