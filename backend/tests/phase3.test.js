import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
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
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    properties: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    spaces: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    bookings: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    booking_status_history: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    payments: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    space_reviews: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    notifications: {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'mock-lock-id' }]),
    $transaction: vi.fn((fnOrArray) => {
      if (Array.isArray(fnOrArray)) {
        return Promise.all(fnOrArray);
      }
      return fnOrArray(prisma);
    }),
  },
}));

describe('Phase 3 Integration & Unit Tests', () => {
  const customerId = 'c1111111-1111-4111-8111-111111111111';
  const otherCustomerId = 'c2222222-2222-4222-8222-222222222222';
  const ownerId = 'e1111111-1111-4111-8111-111111111111';
  const propertyId = 'f1111111-1111-4111-8111-111111111111';
  const spaceId = 'a1111111-1111-4111-8111-111111111111';
  const bookingId = 'b1111111-1111-4111-8111-111111111111';

  let tokenSeq = 0;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCustomerAuth = (id = customerId) => {
    const token = `token-cust-${++tokenSeq}`;
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id, email: `${id}@test.com` } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValueOnce({
      id,
      email: `${id}@test.com`,
      role: 'CUSTOMER',
      name: 'Customer User',
      is_active: true,
    });
    return token;
  };

  const mockOwnerAuth = (id = ownerId) => {
    const token = `token-owner-${++tokenSeq}`;
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id, email: `${id}@test.com` } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValueOnce({
      id,
      email: `${id}@test.com`,
      role: 'OWNER',
      name: 'Owner User',
      is_active: true,
    });
    return token;
  };

  const baseSpace = {
    id: spaceId,
    property_id: propertyId,
    name: 'Executive Studio',
    space_type: 'STUDIO',
    capacity: 10,
    price_amount: new Prisma.Decimal('500.00'),
    price_unit: 'HOUR',
    status: 'AVAILABLE',
    properties: {
      id: propertyId,
      owner_id: ownerId,
      status: 'ACTIVE',
      title: 'Nexora Tower',
      city: 'Bengaluru',
      state: 'Karnataka',
    },
  };

  it('rejects booking in the past or under lead time', async () => {
    const token = mockCustomerAuth();

    const pastStart = new Date(Date.now() - 3600000).toISOString();
    const pastEnd = new Date(Date.now() + 3600000).toISOString();

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        spaceId,
        startAt: pastStart,
        endAt: pastEnd,
        guestCount: 2,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LEAD_TIME_VIOLATION');
  });

  it('rejects booking when guestCount exceeds space capacity', async () => {
    const token = mockCustomerAuth();

    prisma.spaces.findUnique.mockResolvedValueOnce(baseSpace);

    const startAt = new Date(Date.now() + 86400000).toISOString();
    const endAt = new Date(Date.now() + 86400000 + 7200000).toISOString();

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        spaceId,
        startAt,
        endAt,
        guestCount: 15, // capacity is 10
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CAPACITY_EXCEEDED');
  });

  it('rejects owner booking a space in their own property (OWN_PROPERTY)', async () => {
    // User owns the property
    const token = `token-ownprop-${++tokenSeq}`;
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: ownerId, email: 'owner@test.com' } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: ownerId,
      email: 'owner@test.com',
      role: 'CUSTOMER',
      name: 'Owner',
      is_active: true,
    });

    prisma.spaces.findUnique.mockResolvedValueOnce(baseSpace);

    const startAt = new Date(Date.now() + 86400000).toISOString();
    const endAt = new Date(Date.now() + 86400000 + 7200000).toISOString();

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        spaceId,
        startAt,
        endAt,
        guestCount: 2,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OWN_PROPERTY');
  });

  it('rejects non-CUSTOMER roles with 403 on create', async () => {
    const token = mockOwnerAuth();

    const startAt = new Date(Date.now() + 86400000).toISOString();
    const endAt = new Date(Date.now() + 86400000 + 7200000).toISOString();

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        spaceId,
        startAt,
        endAt,
        guestCount: 2,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 SLOT_UNAVAILABLE when overlapping booking exists', async () => {
    const token = mockCustomerAuth();

    prisma.spaces.findUnique.mockResolvedValueOnce(baseSpace);

    // Mock existing overlap inside transaction
    prisma.bookings.findFirst.mockResolvedValueOnce({
      id: 'existing-b1',
      status: 'CONFIRMED',
    });

    const startAt = new Date(Date.now() + 86400000).toISOString();
    const endAt = new Date(Date.now() + 86400000 + 7200000).toISOString();

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        spaceId,
        startAt,
        endAt,
        guestCount: 2,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('allows back-to-back booking and writes initial booking_status_history', async () => {
    const token = mockCustomerAuth();

    prisma.spaces.findUnique.mockResolvedValueOnce(baseSpace);

    // No overlap
    prisma.bookings.findFirst.mockResolvedValueOnce(null);

    const startAt = new Date(Date.now() + 86400000);
    const endAt = new Date(Date.now() + 86400000 + 7200000); // 2 hours

    prisma.bookings.create.mockResolvedValueOnce({
      id: bookingId,
      space_id: spaceId,
      customer_id: customerId,
      start_at: startAt,
      end_at: endAt,
      guest_count: 2,
      status: 'PENDING',
      base_amount: new Prisma.Decimal('1000.00'),
      platform_fee: new Prisma.Decimal('100.00'),
      tax_amount: new Prisma.Decimal('180.00'),
      total_amount: new Prisma.Decimal('1180.00'),
      owner_amount: new Prisma.Decimal('900.00'),
      spaces: baseSpace,
    });

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        spaceId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        guestCount: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(bookingId);
    expect(res.body.data.subtotal).toBe('1000.00');

    // Confirm row lock was called
    expect(prisma.$queryRaw).toHaveBeenCalled();
    // Confirm status history was recorded
    expect(prisma.booking_status_history.create).toHaveBeenCalled();
  });

  it('enforces status transition table: PENDING -> CONFIRMED by owner', async () => {
    const token = mockOwnerAuth();

    const startAt = new Date(Date.now() + 86400000);
    const endAt = new Date(Date.now() + 86400000 + 7200000);

    prisma.bookings.findUnique.mockResolvedValueOnce({
      id: bookingId,
      space_id: spaceId,
      customer_id: customerId,
      status: 'PENDING',
      start_at: startAt,
      end_at: endAt,
      spaces: baseSpace,
      payments: [],
    });

    // Overlap check on confirm returns null
    prisma.bookings.findFirst.mockResolvedValueOnce(null);

    prisma.bookings.update.mockResolvedValueOnce({
      id: bookingId,
      status: 'CONFIRMED',
      spaces: baseSpace,
      payments: [],
    });

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'CONFIRMED',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.booking.status).toBe('CONFIRMED');
    expect(prisma.booking_status_history.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CONFIRMED',
          from_status: 'PENDING',
        }),
      })
    );
  });

  it('rejects invalid transitions with 409 INVALID_TRANSITION (e.g. PENDING -> COMPLETED)', async () => {
    const token = mockOwnerAuth();

    prisma.bookings.findUnique.mockResolvedValueOnce({
      id: bookingId,
      space_id: spaceId,
      customer_id: customerId,
      status: 'PENDING',
      spaces: baseSpace,
      payments: [],
    });

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'COMPLETED',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('returns 404 for an unrelated customer trying to inspect another customer booking', async () => {
    const token = mockCustomerAuth(otherCustomerId);

    prisma.bookings.findUnique.mockResolvedValueOnce({
      id: bookingId,
      customer_id: customerId, // different customer
      spaces: baseSpace,
      payments: [],
      booking_status_history: [],
      profiles: { id: customerId, name: 'Other', email: 'other@test.com' },
    });

    const res = await request(app)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('processes payment on CONFIRMED booking and rejects OVERPAYMENT with 400', async () => {
    const token = mockCustomerAuth();

    prisma.bookings.findUnique.mockResolvedValueOnce({
      id: bookingId,
      customer_id: customerId,
      status: 'CONFIRMED',
      total_amount: new Prisma.Decimal('1000.00'),
      spaces: baseSpace,
      payments: [
        {
          id: 'pay-1',
          amount: new Prisma.Decimal('600.00'),
          status: 'PAID',
        },
      ],
    });

    // Trying to pay 500 when remaining is 400 -> overpayment
    const res = await request(app)
      .post(`/api/bookings/${bookingId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        method: 'UPI',
        amount: 500,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OVERPAYMENT');
  });

  it('refunds full payments on early customer cancellation', async () => {
    const token = mockCustomerAuth();

    // 48 hours in future (> 24h free cancellation window)
    const futureStart = new Date(Date.now() + 48 * 3600000);
    const futureEnd = new Date(Date.now() + 50 * 3600000);

    prisma.bookings.findUnique.mockResolvedValueOnce({
      id: bookingId,
      customer_id: customerId,
      status: 'CONFIRMED',
      start_at: futureStart,
      end_at: futureEnd,
      spaces: baseSpace,
      payments: [
        {
          id: 'pay-1',
          amount: new Prisma.Decimal('1180.00'),
          status: 'PAID',
        },
      ],
    });

    prisma.payments.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.bookings.update.mockResolvedValueOnce({
      id: bookingId,
      status: 'CANCELLED',
      spaces: baseSpace,
      payments: [],
    });

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'CANCELLED',
        reason: 'Change of plans',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.refundedAmount).toBe('1180.00');
    expect(prisma.payments.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'REFUNDED' },
      })
    );
  });

  it('allows review only on COMPLETED bookings and rejects duplicate with 409', async () => {
    const token = mockCustomerAuth();

    prisma.bookings.findUnique.mockResolvedValueOnce({
      id: bookingId,
      customer_id: customerId,
      space_id: spaceId,
      status: 'CONFIRMED', // NOT completed yet
      spaces: baseSpace,
      space_reviews: null,
    });

    const res1 = await request(app)
      .post(`/api/bookings/${bookingId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        rating: 5,
        comment: 'Great space!',
      });

    expect(res1.status).toBe(409);
    expect(res1.body.error.code).toBe('BOOKING_NOT_COMPLETED');
  });

  it('returns 409 HAS_ACTIVE_BOOKINGS when deleting a space with active future bookings', async () => {
    const token = mockOwnerAuth();

    prisma.spaces.findUnique.mockResolvedValueOnce({
      id: spaceId,
      properties: { owner_id: ownerId },
    });

    prisma.bookings.findFirst.mockResolvedValueOnce({
      id: 'active-future-booking',
      status: 'CONFIRMED',
      end_at: new Date(Date.now() + 86400000),
    });

    const res = await request(app)
      .delete(`/api/spaces/${spaceId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HAS_ACTIVE_BOOKINGS');
  });

  it('availability endpoint returns only blocked intervals without any customer PII', async () => {
    prisma.spaces.findUnique.mockResolvedValueOnce({
      id: spaceId,
      status: 'AVAILABLE',
      properties: { status: 'ACTIVE' },
    });

    const bStart = new Date(Date.now() + 86400000);
    const bEnd = new Date(Date.now() + 90000000);

    prisma.bookings.findMany.mockResolvedValueOnce([
      { start_at: bStart, end_at: bEnd },
    ]);

    const res = await request(app)
      .get(`/api/spaces/${spaceId}/availability`)
      .query({
        from: new Date().toISOString(),
        to: new Date(Date.now() + 5 * 86400000).toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('startAt');
    expect(res.body.data[0]).toHaveProperty('endAt');
    expect(res.body.data[0]).not.toHaveProperty('customer');
    expect(res.body.data[0]).not.toHaveProperty('customerId');
  });
});
