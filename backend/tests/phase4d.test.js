import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { supabase } from '../src/lib/supabase.js';
import { prisma } from '../src/lib/prisma.js';
import { resolveDateRange } from '../src/services/dashboard.service.js';

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
      groupBy: vi.fn(),
    },
    properties: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    spaces: {
      findMany: vi.fn(),
    },
    bookings: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    payments: {
      findMany: vi.fn(),
    },
    property_expenses: {
      findMany: vi.fn(),
    },
    maintenance_requests: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    maintenance_updates: {
      findMany: vi.fn(),
    },
    booking_status_history: {
      findMany: vi.fn(),
    },
    inspections: {
      findMany: vi.fn(),
    },
    service_providers: {
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../src/services/inspection.service.js', () => ({
  getPropertyHealth: vi.fn().mockResolvedValue({
    score: '92.50',
    grade: 'A',
    trend: 'STABLE',
    inspectedAt: new Date('2026-10-01'),
  }),
  getOwnerHealthOverview: vi.fn().mockResolvedValue([
    {
      id: 'prop-1',
      title: 'Horizon Center',
      latestScore: '92.50',
      grade: 'A',
      trend: 'IMPROVING',
      lastInspectedDate: new Date('2026-10-01'),
      overdue: false,
    },
    {
      id: 'prop-2',
      title: 'Sunset Studios',
      latestScore: null,
      grade: null,
      trend: 'NO_DATA',
      lastInspectedDate: null,
      overdue: true,
    },
  ]),
}));

describe('Phase 4D — Owner & Admin Dashboard API Tests', () => {
  const OWNER_USER = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'owner@example.com',
    role: 'OWNER',
    name: 'Harish Mehta',
    phone: '+919876543210',
    is_active: true,
  };

  const OTHER_OWNER_USER = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'other_owner@example.com',
    role: 'OWNER',
    name: 'Kavita Rao',
    phone: '+919876543211',
    is_active: true,
  };

  const CUSTOMER_USER = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'customer@example.com',
    role: 'CUSTOMER',
    name: 'Amit Kumar',
    phone: '+919876543212',
    is_active: true,
  };

  const PROVIDER_USER = {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'provider@example.com',
    role: 'PROVIDER',
    name: 'Ramesh Plumber',
    phone: '+919876543213',
    is_active: true,
  };

  const ADMIN_USER = {
    id: '55555555-5555-4555-8555-555555555555',
    email: 'admin@example.com',
    role: 'ADMIN',
    name: 'Admin Boss',
    phone: '+919876543214',
    is_active: true,
  };

  const PROPERTY_ID = '99999999-9999-4999-8999-999999999999';

  function authHeader(user) {
    return `Bearer token-${user.id}`;
  }

  function mockAuth(user) {
    if (!user) {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('No session'),
      });
      return;
    }

    supabase.auth.getUser.mockImplementation((token) => {
      if (token === `token-${user.id}`) {
        return Promise.resolve({
          data: {
            user: {
              id: user.id,
              email: user.email,
            },
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: { user: null },
        error: new Error('Invalid token'),
      });
    });

    prisma.profiles.findUnique.mockResolvedValue(user);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Date Range & Kolkata Calendar Months Logic', () => {
    it('generates 12 continuous calendar months across year boundaries', () => {
      const range = resolveDateRange('2025-11-15', '2026-03-20');
      expect(range.months).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
      expect(range.daysInRange).toBeGreaterThan(120);
    });

    it('rejects from date after to date', () => {
      expect(() => resolveDateRange('2026-05-01', '2026-04-01')).toThrow();
    });
  });

  describe('2. GET /api/owner/dashboard', () => {
    it('returns comprehensive dashboard with exact financial calculations', async () => {
      mockAuth(OWNER_USER);

      // Setup raw query responses for dashboard
      prisma.$queryRaw.mockImplementation((query) => {
        const sqlText = Array.isArray(query) ? query.join(' ') : String(query);

        // Q1: Payment Totals
        if (sqlText.includes('gross_collected')) {
          return Promise.resolve([
            {
              income_received: 900.0,
              gross_collected: 1180.0,
              platform_fees_paid: 100.0,
              tax_collected: 180.0,
              refunded_amount: 500.0,
            },
          ]);
        }

        // Q2: Expected Income
        if (sqlText.includes('income_expected')) {
          return Promise.resolve([{ income_expected: 1500.0 }]);
        }

        // Q3: Total Expenses
        if (sqlText.includes('total_expenses')) {
          return Promise.resolve([{ total_expenses: 400.0 }]);
        }

        // Q4: Monthly Income
        if (sqlText.includes('to_char(timezone(\'Asia/Kolkata\', p.paid_at)')) {
          return Promise.resolve([
            { month: '2026-09', income_received: 450.0 },
            { month: '2026-10', income_received: 450.0 },
          ]);
        }

        // Q5: Monthly Expenses
        if (sqlText.includes('to_char(pe.incurred_on')) {
          return Promise.resolve([
            { month: '2026-10', expenses: 400.0 },
          ]);
        }

        // Q6: Booking counts
        if (sqlText.includes('b.status') && sqlText.includes('in_period_count')) {
          return Promise.resolve([
            { status: 'CONFIRMED', count: 5, in_period_count: 5 },
            { status: 'COMPLETED', count: 10, in_period_count: 8 },
            { status: 'CANCELLED', count: 2, in_period_count: 2 },
          ]);
        }

        // Q7: Occupancy
        if (sqlText.includes('available_spaces') && sqlText.includes('booked_hours')) {
          return Promise.resolve([
            { available_spaces: 2, booked_hours: 480.0 },
          ]);
        }

        // Q8: Top Spaces
        if (sqlText.includes('"spaceId"')) {
          return Promise.resolve([
            {
              spaceId: 'sp-1',
              spaceName: 'Boardroom A',
              propertyTitle: 'Sunset Tower',
              incomeReceived: 900.0,
              bookingCount: 15,
            },
          ]);
        }

        // Q9: Maintenance stats
        if (sqlText.includes('urgent_high_open')) {
          return Promise.resolve([
            { status: 'OPEN', count: 2, urgent_high_open: 1, total_actual_cost: 0 },
            { status: 'COMPLETED', count: 3, urgent_high_open: 0, total_actual_cost: 650.0 },
          ]);
        }

        return Promise.resolve([]);
      });

      // Upcoming bookings with full name (only first name should be returned)
      prisma.bookings.findMany.mockResolvedValue([
        {
          id: 'b-1',
          start_at: new Date('2026-12-01T10:00:00Z'),
          end_at: new Date('2026-12-01T14:00:00Z'),
          spaces: {
            name: 'Boardroom A',
            properties: { title: 'Sunset Tower' },
          },
          profiles: { name: 'Priya Sharma Kapoor' },
        },
      ]);

      prisma.inspections.findMany.mockResolvedValue([]);
      prisma.maintenance_requests.findMany.mockResolvedValue([]);
      prisma.booking_status_history.findMany.mockResolvedValue([]);
      prisma.payments.findMany.mockResolvedValue([]);
      prisma.maintenance_updates.findMany.mockResolvedValue([
        {
          note: 'Repaired sink. Contact tech at plumber@pipes.com or 9876543210',
          created_at: new Date('2026-10-15T10:00:00Z'),
          maintenance_requests: {
            title: 'Leaky Pipe',
            properties: { title: 'Sunset Tower' },
          },
        },
      ]);

      const res = await request(app)
        .get('/api/owner/dashboard?from=2026-09-01&to=2026-10-31')
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const d = res.body.data;

      // Check Totals
      expect(d.totals.incomeReceived).toBe('900.00');
      expect(d.totals.grossCollected).toBe('1180.00');
      expect(d.totals.platformFeesPaid).toBe('100.00');
      expect(d.totals.taxCollected).toBe('180.00');
      expect(d.totals.refundedAmount).toBe('500.00');
      expect(d.totals.expenses).toBe('400.00');
      expect(d.totals.net).toBe('500.00'); // 900 - 400
      expect(d.totals.incomeExpected).toBe('1500.00');
      expect(d.totals.roundingDifference).toBe('0.00'); // 1180 - (900 + 100 + 180) = 0

      // Check Monthly Series: all months present in range
      expect(d.series).toHaveLength(2);
      expect(d.series[0].month).toBe('2026-09');
      expect(d.series[0].incomeReceived).toBe('450.00');
      expect(d.series[0].expenses).toBe('0.00');
      expect(d.series[0].net).toBe('450.00');

      expect(d.series[1].month).toBe('2026-10');
      expect(d.series[1].incomeReceived).toBe('450.00');
      expect(d.series[1].expenses).toBe('400.00');
      expect(d.series[1].net).toBe('50.00');

      // Check Booking Counts
      expect(d.bookingCounts.CONFIRMED).toBe(5);
      expect(d.bookingCounts.COMPLETED).toBe(10);
      expect(d.bookingsThisPeriod).toBe(15);

      // Check Occupancy (non-null, capped at 100)
      expect(d.occupancy).toBeGreaterThan(0);
      expect(d.occupancy).toBeLessThanOrEqual(100);

      // Check Top Spaces
      expect(d.topSpaces).toHaveLength(1);
      expect(d.topSpaces[0].spaceName).toBe('Boardroom A');
      expect(d.topSpaces[0].incomeReceived).toBe('900.00');

      // Check Maintenance
      expect(d.maintenance.countsByStatus.OPEN).toBe(2);
      expect(d.maintenance.urgentHighOpenCount).toBe(1);
      expect(d.maintenance.totalActualCost).toBe('650.00');

      // Check Health
      expect(d.health.properties).toHaveLength(2);
      expect(d.health.overdueProperties).toBe(1);

      // Check Upcoming: Customer FIRST NAME ONLY
      expect(d.upcoming.nextBookings[0].customerFirstName).toBe('Priya');
      expect(JSON.stringify(d.upcoming)).not.toContain('Sharma');

      // Check Recent Activity: Emails and Phones redacted
      expect(d.recentActivity[0].text).toContain('[REDACTED_EMAIL]');
      expect(d.recentActivity[0].text).toContain('[REDACTED_PHONE]');
      expect(d.recentActivity[0].text).not.toContain('plumber@pipes.com');
      expect(d.recentActivity[0].text).not.toContain('9876543210');
    });

    it('returns occupancy as null when there are no available spaces', async () => {
      mockAuth(OWNER_USER);

      prisma.$queryRaw.mockImplementation((query) => {
        const sqlText = Array.isArray(query) ? query.join(' ') : String(query);
        if (sqlText.includes('available_spaces')) {
          return Promise.resolve([{ available_spaces: 0, booked_hours: 0 }]);
        }
        return Promise.resolve([{}]);
      });

      prisma.bookings.findMany.mockResolvedValue([]);
      prisma.inspections.findMany.mockResolvedValue([]);
      prisma.maintenance_requests.findMany.mockResolvedValue([]);
      prisma.booking_status_history.findMany.mockResolvedValue([]);
      prisma.payments.findMany.mockResolvedValue([]);
      prisma.maintenance_updates.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/owner/dashboard')
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.data.occupancy).toBeNull();
    });

    it('returns 404 when querying another owner property', async () => {
      mockAuth(OWNER_USER);

      prisma.properties.findUnique.mockResolvedValue({
        id: PROPERTY_ID,
        owner_id: OTHER_OWNER_USER.id,
      });

      const res = await request(app)
        .get(`/api/owner/dashboard?propertyId=${PROPERTY_ID}`)
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(404);
    });

    it('returns 404 for CUSTOMER and PROVIDER (hides owner dashboard)', async () => {
      mockAuth(CUSTOMER_USER);

      let res = await request(app)
        .get('/api/owner/dashboard')
        .set('Authorization', authHeader(CUSTOMER_USER));
      expect(res.status).toBe(404);

      mockAuth(PROVIDER_USER);
      res = await request(app)
        .get('/api/owner/dashboard')
        .set('Authorization', authHeader(PROVIDER_USER));
      expect(res.status).toBe(404);
    });
  });

  describe('3. GET /api/owner/dashboard/properties', () => {
    it('returns one row per property using ONE query set', async () => {
      mockAuth(OWNER_USER);

      prisma.properties.findMany.mockResolvedValue([
        {
          id: 'prop-1',
          title: 'Horizon Center',
          address_line1: 'Koramangala 4th Block',
          city: 'Bengaluru',
        },
      ]);

      prisma.$queryRaw.mockImplementation((query) => {
        const sqlText = Array.isArray(query) ? query.join(' ') : String(query);

        if (sqlText.includes('income_received')) {
          return Promise.resolve([{ property_id: 'prop-1', income_received: 1200.0 }]);
        }
        if (sqlText.includes('expenses')) {
          return Promise.resolve([{ property_id: 'prop-1', expenses: 200.0 }]);
        }
        if (sqlText.includes('booked_hours')) {
          return Promise.resolve([{ property_id: 'prop-1', booking_count: 4, booked_hours: 96.0 }]);
        }
        if (sqlText.includes('available_spaces')) {
          return Promise.resolve([{ property_id: 'prop-1', available_spaces: 2 }]);
        }
        return Promise.resolve([]);
      });

      const res = await request(app)
        .get('/api/owner/dashboard/properties?from=2026-10-01&to=2026-10-31')
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);

      const prop = res.body.data[0];
      expect(prop.propertyId).toBe('prop-1');
      expect(prop.title).toBe('Horizon Center');
      expect(prop.incomeReceived).toBe('1200.00');
      expect(prop.expenses).toBe('200.00');
      expect(prop.net).toBe('1000.00');
      expect(prop.bookingCount).toBe(4);
      expect(prop.occupancy).toBeGreaterThan(0);
      expect(prop.healthScore).toBe('92.50');
      expect(prop.healthGrade).toBe('A');
    });
  });

  describe('4. GET /api/owner/dashboard/reconcile', () => {
    it('returns raw payment and expense lists that reconcile to totals', async () => {
      mockAuth(OWNER_USER);

      prisma.$queryRaw.mockImplementation((query) => {
        const sqlText = Array.isArray(query) ? query.join(' ') : String(query);

        if (sqlText.includes('COUNT(*) AS total') && sqlText.includes('payments')) {
          return Promise.resolve([{ total: 1 }]);
        }
        if (sqlText.includes('COUNT(*) AS total') && sqlText.includes('property_expenses')) {
          return Promise.resolve([{ total: 1 }]);
        }
        if (sqlText.includes('ownerShare')) {
          return Promise.resolve([
            {
              id: 'pay-1',
              bookingId: 'book-1',
              paidAt: new Date('2026-10-10T12:00:00Z'),
              amount: 1180.0,
              ownerShare: 900.0,
              platformFeeShare: 100.0,
              taxShare: 180.0,
            },
          ]);
        }
        if (sqlText.includes('incurredOn')) {
          return Promise.resolve([
            {
              id: 'exp-1',
              propertyId: PROPERTY_ID,
              incurredOn: new Date('2026-10-12'),
              category: 'UTILITIES',
              amount: 250.0,
              description: 'Electricity bill',
            },
          ]);
        }
        if (sqlText.includes('gross_collected')) {
          return Promise.resolve([
            {
              income_received: 900.0,
              gross_collected: 1180.0,
              platform_fees_paid: 100.0,
              tax_collected: 180.0,
              refunded_amount: 0,
            },
          ]);
        }
        if (sqlText.includes('total_expenses')) {
          return Promise.resolve([{ total_expenses: 250.0 }]);
        }
        if (sqlText.includes('income_expected')) {
          return Promise.resolve([{ income_expected: 0 }]);
        }
        return Promise.resolve([]);
      });

      prisma.bookings.findMany.mockResolvedValue([]);
      prisma.inspections.findMany.mockResolvedValue([]);
      prisma.maintenance_requests.findMany.mockResolvedValue([]);
      prisma.booking_status_history.findMany.mockResolvedValue([]);
      prisma.payments.findMany.mockResolvedValue([]);
      prisma.maintenance_updates.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/owner/dashboard/reconcile?page=1&limit=50')
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const d = res.body.data;
      expect(d.payments).toHaveLength(1);
      expect(d.payments[0].ownerShare).toBe('900.00');

      expect(d.expenses).toHaveLength(1);
      expect(d.expenses[0].amount).toBe('250.00');

      // The raw list values match totals exactly
      expect(d.totals.incomeReceived).toBe('900.00');
      expect(d.totals.expenses).toBe('250.00');
      expect(d.totals.net).toBe('650.00');
    });
  });

  describe('5. GET /api/admin/dashboard', () => {
    it('returns platform-wide metrics with zero personal data', async () => {
      mockAuth(ADMIN_USER);

      prisma.$queryRaw.mockResolvedValue([
        {
          gross_volume: 50000.0,
          platform_fees_earned: 4500.0,
        },
      ]);

      prisma.bookings.groupBy.mockResolvedValue([
        { status: 'CONFIRMED', _count: { id: 12 } },
        { status: 'COMPLETED', _count: { id: 40 } },
      ]);

      prisma.profiles.groupBy.mockResolvedValue([
        { role: 'CUSTOMER', _count: { id: 100 } },
        { role: 'OWNER', _count: { id: 10 } },
        { role: 'PROVIDER', _count: { id: 15 } },
        { role: 'ADMIN', _count: { id: 2 } },
      ]);

      prisma.properties.count.mockResolvedValue(25);
      prisma.service_providers.count.mockResolvedValue(3);
      prisma.maintenance_requests.count.mockResolvedValue(8);

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', authHeader(ADMIN_USER));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const d = res.body.data;
      expect(d.grossVolume).toBe('50000.00');
      expect(d.platformFeesEarned).toBe('4500.00');
      expect(d.activeProperties).toBe(25);
      expect(d.pendingProviderVerifications).toBe(3);
      expect(d.openMaintenance).toBe(8);
      expect(d.bookingsByStatus.COMPLETED).toBe(40);
      expect(d.usersByRole.CUSTOMER).toBe(100);

      // Verify ZERO personal data exists in response
      const rawText = JSON.stringify(d);
      expect(rawText).not.toContain('@');
      expect(rawText).not.toContain('Harish');
      expect(rawText).not.toContain('Mehta');
      expect(rawText).not.toContain('+91');
    });

    it('rejects non-admin access with 403 Forbidden', async () => {
      mockAuth(OWNER_USER);

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(403);
    });
  });
});
