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
    properties: {
      groupBy: vi.fn(),
    },
    bookings: {
      groupBy: vi.fn(),
    },
    service_categories: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  },
}));

describe('Admin Self-Modification Protection & Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin cannot demote their own role', async () => {
    const adminId = 'a1111111-1111-1111-1111-111111111111';
    const token = 'admin-token-demote';

    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: adminId, email: 'admin@nexora.com' } },
      error: null,
    });

    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: adminId,
      email: 'admin@nexora.com',
      role: 'ADMIN',
      name: 'Lead Admin',
      is_active: true,
    });

    const res = await request(app)
      .patch(`/api/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'CUSTOMER' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.message).toContain('cannot demote');
  });

  it('admin cannot deactivate their own account', async () => {
    const adminId = 'a1111111-1111-1111-1111-111111111111';
    const token = 'admin-token-deactivate';

    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: adminId, email: 'admin@nexora.com' } },
      error: null,
    });

    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: adminId,
      email: 'admin@nexora.com',
      role: 'ADMIN',
      name: 'Lead Admin',
      is_active: true,
    });

    const res = await request(app)
      .patch(`/api/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.message).toContain('cannot deactivate');
  });

  it('validation error returns 400 with field details', async () => {
    const adminId = 'a1111111-1111-1111-1111-111111111111';
    const token = 'admin-token-invalid';

    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: adminId, email: 'admin@nexora.com' } },
      error: null,
    });

    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: adminId,
      email: 'admin@nexora.com',
      role: 'ADMIN',
      name: 'Lead Admin',
      is_active: true,
    });

    // Invalid role value
    const targetUserId = 'b2222222-2222-2222-2222-222222222222';
    const res = await request(app)
      .patch(`/api/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'SUPER_USER' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeInstanceOf(Array);
    expect(res.body.error.details[0].field).toBe('role');
  });
});
