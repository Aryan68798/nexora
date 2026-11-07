import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { app } from '../src/app.js';
import { supabase } from '../src/lib/supabase.js';
import { prisma } from '../src/lib/prisma.js';
import { storageService } from '../src/services/storage.service.js';

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
    },
    properties: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    property_expenses: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    maintenance_requests: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    media_assets: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    notifications: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../src/services/storage.service.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    storageService: {
      uploadPrivateFile: vi.fn(),
      deleteFile: vi.fn(),
      getSignedUrl: vi.fn(),
    },
  };
});

describe('Phase 4C — Property Expenses & Job Expense Integration API Tests', () => {
  const OWNER_USER = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'owner@example.com',
    role: 'OWNER',
    name: 'Property Owner',
    phone: '+919876543210',
    is_active: true,
  };

  const OTHER_OWNER_USER = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'other_owner@example.com',
    role: 'OWNER',
    name: 'Other Owner',
    phone: '+919876543211',
    is_active: true,
  };

  const CUSTOMER_USER = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'customer@example.com',
    role: 'CUSTOMER',
    name: 'Customer User',
    phone: '+919876543212',
    is_active: true,
  };

  const PROVIDER_USER = {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'provider@example.com',
    role: 'PROVIDER',
    name: 'Service Provider',
    phone: '+919876543213',
    is_active: true,
  };

  const ADMIN_USER = {
    id: '55555555-5555-4555-8555-555555555555',
    email: 'admin@example.com',
    role: 'ADMIN',
    name: 'Admin User',
    phone: '+919876543214',
    is_active: true,
  };

  const PROPERTY_ID = '99999999-9999-4999-8999-999999999999';
  const EXPENSE_ID = '88888888-8888-4888-8888-888888888888';
  const JOB_ID = '77777777-7777-4777-8777-777777777777';

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

  describe('1. GET /api/expenses/categories', () => {
    it('returns 200 with 8 categories for OWNER', async () => {
      mockAuth(OWNER_USER);

      const res = await request(app)
        .get('/api/expenses/categories')
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([
        'MAINTENANCE',
        'UTILITIES',
        'TAXES',
        'INSURANCE',
        'CLEANING',
        'SUPPLIES',
        'SALARY',
        'OTHER',
      ]);
    });

    it('returns 404 for CUSTOMER (hides resource)', async () => {
      mockAuth(CUSTOMER_USER);

      const res = await request(app)
        .get('/api/expenses/categories')
        .set('Authorization', authHeader(CUSTOMER_USER));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for PROVIDER (hides resource)', async () => {
      mockAuth(PROVIDER_USER);

      const res = await request(app)
        .get('/api/expenses/categories')
        .set('Authorization', authHeader(PROVIDER_USER));

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for unauthenticated request', async () => {
      mockAuth(null);

      const res = await request(app).get('/api/expenses/categories');
      expect(res.status).toBe(401);
    });
  });

  describe('2. POST /api/properties/:propertyId/expenses', () => {
    it('allows property OWNER to create manual expense', async () => {
      mockAuth(OWNER_USER);

      prisma.properties.findUnique.mockResolvedValue({
        id: PROPERTY_ID,
        owner_id: OWNER_USER.id,
        title: 'Sunset Villa',
      });

      prisma.property_expenses.create.mockResolvedValue({
        id: EXPENSE_ID,
        property_id: PROPERTY_ID,
        added_by: OWNER_USER.id,
        maintenance_request_id: null,
        category: 'UTILITIES',
        description: 'Monthly electricity bill',
        amount: new Prisma.Decimal('1250.50'),
        incurred_on: new Date('2026-10-15T00:00:00.000Z'),
        receipt_url: null,
        created_at: new Date('2026-10-15T10:00:00.000Z'),
        maintenance_requests: null,
      });

      const res = await request(app)
        .post(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({
          category: 'UTILITIES',
          description: 'Monthly electricity bill',
          amount: 1250.5,
          incurredOn: '2026-10-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe('1250.50');
      expect(res.body.data.category).toBe('UTILITIES');
      expect(res.body.data.hasReceipt).toBe(false);
    });

    it('returns 404 when another owner attempts to add an expense', async () => {
      mockAuth(OTHER_OWNER_USER);

      prisma.properties.findUnique.mockResolvedValue({
        id: PROPERTY_ID,
        owner_id: OWNER_USER.id,
        title: 'Sunset Villa',
      });

      const res = await request(app)
        .post(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(OTHER_OWNER_USER))
        .send({
          category: 'UTILITIES',
          description: 'Electricity bill',
          amount: 500,
          incurredOn: '2026-10-15',
        });

      expect(res.status).toBe(404);
    });

    it('returns 404 for CUSTOMER or PROVIDER', async () => {
      mockAuth(CUSTOMER_USER);

      const res = await request(app)
        .post(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(CUSTOMER_USER))
        .send({
          category: 'UTILITIES',
          description: 'Electricity bill',
          amount: 500,
          incurredOn: '2026-10-15',
        });

      expect(res.status).toBe(404);
    });

    it('rejects addedBy injected in body due to .strict() validation', async () => {
      mockAuth(OWNER_USER);

      const res = await request(app)
        .post(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({
          category: 'UTILITIES',
          description: 'Electricity bill',
          amount: 500,
          incurredOn: '2026-10-15',
          addedBy: OWNER_USER.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid category, 0 or negative amount, 3 decimals, future date, missing description', async () => {
      mockAuth(OWNER_USER);

      // Invalid category
      let res = await request(app)
        .post(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({
          category: 'INVALID_CATEGORY',
          description: 'Valid description',
          amount: 100,
          incurredOn: '2026-10-15',
        });
      expect(res.status).toBe(400);

      // Zero amount
      res = await request(app)
        .post(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({
          category: 'UTILITIES',
          description: 'Valid description',
          amount: 0,
          incurredOn: '2026-10-15',
        });
      expect(res.status).toBe(400);

      // Negative amount
      res = await request(app)
        .post(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({
          category: 'UTILITIES',
          description: 'Valid description',
          amount: -50,
          incurredOn: '2026-10-15',
        });
      expect(res.status).toBe(400);

      // 3 decimals
      res = await request(app)
        .post(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({
          category: 'UTILITIES',
          description: 'Valid description',
          amount: '100.555',
          incurredOn: '2026-10-15',
        });
      expect(res.status).toBe(400);

      // Future date
      res = await request(app)
        .post(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({
          category: 'UTILITIES',
          description: 'Valid description',
          amount: 100,
          incurredOn: '2099-01-01',
        });
      expect(res.status).toBe(400);

      // Missing description
      res = await request(app)
        .post(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({
          category: 'UTILITIES',
          amount: 100,
          incurredOn: '2026-10-15',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('3. GET /api/properties/:propertyId/expenses (Listing & Pagination)', () => {
    it('returns paginated items and totalAmount covering all matching rows', async () => {
      mockAuth(OWNER_USER);

      prisma.properties.findUnique.mockResolvedValue({
        id: PROPERTY_ID,
        owner_id: OWNER_USER.id,
      });

      prisma.property_expenses.count.mockResolvedValue(25);
      prisma.property_expenses.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('15750.00') },
      });
      prisma.property_expenses.findMany.mockResolvedValue([
        {
          id: EXPENSE_ID,
          property_id: PROPERTY_ID,
          added_by: OWNER_USER.id,
          maintenance_request_id: null,
          category: 'TAXES',
          description: 'Property tax Q3',
          amount: new Prisma.Decimal('5000.00'),
          incurred_on: new Date('2026-09-01T00:00:00.000Z'),
          receipt_url: null,
          created_at: new Date('2026-09-01T10:00:00.000Z'),
          maintenance_requests: null,
        },
      ]);

      const res = await request(app)
        .get(`/api/properties/${PROPERTY_ID}/expenses?page=1&limit=10`)
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(25);
      expect(res.body.meta.totalPages).toBe(3);
      expect(res.body.meta.totalAmount).toBe('15750.00');
    });

    it('allows ADMIN to view expenses for any property', async () => {
      mockAuth(ADMIN_USER);

      prisma.properties.findUnique.mockResolvedValue({
        id: PROPERTY_ID,
        owner_id: OWNER_USER.id,
      });

      prisma.property_expenses.count.mockResolvedValue(1);
      prisma.property_expenses.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('100.00') },
      });
      prisma.property_expenses.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(ADMIN_USER));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for unpermitted users', async () => {
      mockAuth(PROVIDER_USER);

      const res = await request(app)
        .get(`/api/properties/${PROPERTY_ID}/expenses`)
        .set('Authorization', authHeader(PROVIDER_USER));

      expect(res.status).toBe(404);
    });
  });

  describe('4. GET /api/properties/:propertyId/expenses/summary', () => {
    it('returns grouped category and month breakdowns for owner', async () => {
      mockAuth(OWNER_USER);

      prisma.properties.findUnique.mockResolvedValue({
        id: PROPERTY_ID,
        owner_id: OWNER_USER.id,
      });

      prisma.property_expenses.groupBy.mockResolvedValue([
        {
          category: 'UTILITIES',
          _sum: { amount: new Prisma.Decimal('3000.00') },
          _count: { id: 3 },
        },
        {
          category: 'MAINTENANCE',
          _sum: { amount: new Prisma.Decimal('1000.00') },
          _count: { id: 1 },
        },
      ]);

      prisma.$queryRaw.mockResolvedValue([
        { month: '2026-05', total: 1000.0 },
        { month: '2026-06', total: 3000.0 },
      ]);

      const res = await request(app)
        .get(`/api/properties/${PROPERTY_ID}/expenses/summary?from=2026-05-01&to=2026-06-30`)
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe('4000.00');
      expect(res.body.data.count).toBe(4);
      expect(res.body.data.byCategory).toHaveLength(2);
      expect(res.body.data.byCategory[0].percent).toBe('75.0');
      expect(res.body.data.byCategory[1].percent).toBe('25.0');
      expect(res.body.data.byMonth).toHaveLength(2);
      expect(res.body.data.byMonth[0].month).toBe('2026-05');
      expect(res.body.data.byMonth[0].total).toBe('1000.00');
    });

    it('returns 0.00 and empty categories when no data exists', async () => {
      mockAuth(OWNER_USER);

      prisma.properties.findUnique.mockResolvedValue({
        id: PROPERTY_ID,
        owner_id: OWNER_USER.id,
      });

      prisma.property_expenses.groupBy.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/properties/${PROPERTY_ID}/expenses/summary?from=2026-01-01&to=2026-03-31`)
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe('0.00');
      expect(res.body.data.count).toBe(0);
      expect(res.body.data.byCategory).toEqual([]);
      expect(res.body.data.byMonth).toHaveLength(3);
      expect(res.body.data.byMonth[0].total).toBe('0.00');
      expect(res.body.data.byMonth[1].total).toBe('0.00');
      expect(res.body.data.byMonth[2].total).toBe('0.00');
    });
  });

  describe('5. GET /api/expenses/:id', () => {
    it('returns single expense with signed URL and jobCostMismatch=false when matched', async () => {
      mockAuth(OWNER_USER);

      storageService.getSignedUrl.mockResolvedValue('https://storage.supabase.co/signed-receipt.pdf');

      prisma.property_expenses.findUnique.mockResolvedValue({
        id: EXPENSE_ID,
        property_id: PROPERTY_ID,
        added_by: OWNER_USER.id,
        maintenance_request_id: JOB_ID,
        category: 'MAINTENANCE',
        description: 'AC Repair expense',
        amount: new Prisma.Decimal('450.00'),
        incurred_on: new Date('2026-10-10T00:00:00.000Z'),
        receipt_url: `${PROPERTY_ID}/${EXPENSE_ID}/file.pdf`,
        created_at: new Date('2026-10-10T12:00:00.000Z'),
        properties: { id: PROPERTY_ID, owner_id: OWNER_USER.id },
        maintenance_requests: { id: JOB_ID, title: 'AC Repair', actual_cost: new Prisma.Decimal('450.00') },
      });

      const res = await request(app)
        .get(`/api/expenses/${EXPENSE_ID}`)
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.receiptUrl).toBe('https://storage.supabase.co/signed-receipt.pdf');
      expect(res.body.data.jobCostMismatch).toBe(false);
      expect(storageService.getSignedUrl).toHaveBeenCalledWith(
        'receipts',
        `${PROPERTY_ID}/${EXPENSE_ID}/file.pdf`,
        3600
      );
    });

    it('returns jobCostMismatch=true when expense amount was edited away from actual_cost', async () => {
      mockAuth(OWNER_USER);

      prisma.property_expenses.findUnique.mockResolvedValue({
        id: EXPENSE_ID,
        property_id: PROPERTY_ID,
        added_by: OWNER_USER.id,
        maintenance_request_id: JOB_ID,
        category: 'MAINTENANCE',
        description: 'AC Repair expense edited',
        amount: new Prisma.Decimal('550.00'),
        incurred_on: new Date('2026-10-10T00:00:00.000Z'),
        receipt_url: null,
        created_at: new Date('2026-10-10T12:00:00.000Z'),
        properties: { id: PROPERTY_ID, owner_id: OWNER_USER.id },
        maintenance_requests: { id: JOB_ID, title: 'AC Repair', actual_cost: new Prisma.Decimal('450.00') },
      });

      const res = await request(app)
        .get(`/api/expenses/${EXPENSE_ID}`)
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.data.jobCostMismatch).toBe(true);
      expect(res.body.data.jobActualCost).toBe('450.00');
      expect(res.body.data.expenseAmount).toBe('550.00');
    });

    it('returns 404 for other owner', async () => {
      mockAuth(OTHER_OWNER_USER);

      prisma.property_expenses.findUnique.mockResolvedValue({
        id: EXPENSE_ID,
        property_id: PROPERTY_ID,
        added_by: OWNER_USER.id,
        maintenance_request_id: null,
        category: 'OTHER',
        description: 'Other owner expense',
        amount: new Prisma.Decimal('100.00'),
        incurred_on: new Date('2026-10-10T00:00:00.000Z'),
        receipt_url: null,
        created_at: new Date('2026-10-10T12:00:00.000Z'),
        properties: { id: PROPERTY_ID, owner_id: OWNER_USER.id },
        maintenance_requests: null,
      });

      const res = await request(app)
        .get(`/api/expenses/${EXPENSE_ID}`)
        .set('Authorization', authHeader(OTHER_OWNER_USER));

      expect(res.status).toBe(404);
    });
  });

  describe('6. PATCH /api/expenses/:id & DELETE /api/expenses/:id', () => {
    it('updates expense fields correctly and rejects invalid fields', async () => {
      mockAuth(OWNER_USER);

      prisma.property_expenses.findUnique.mockResolvedValue({
        id: EXPENSE_ID,
        properties: { owner_id: OWNER_USER.id },
      });

      prisma.property_expenses.update.mockResolvedValue({
        id: EXPENSE_ID,
        property_id: PROPERTY_ID,
        added_by: OWNER_USER.id,
        maintenance_request_id: null,
        category: 'CLEANING',
        description: 'Deep cleaning space',
        amount: new Prisma.Decimal('750.00'),
        incurred_on: new Date('2026-10-12T00:00:00.000Z'),
        receipt_url: null,
        created_at: new Date('2026-10-10T12:00:00.000Z'),
        maintenance_requests: null,
      });

      const res = await request(app)
        .patch(`/api/expenses/${EXPENSE_ID}`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({
          category: 'CLEANING',
          amount: 750,
          description: 'Deep cleaning space',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe('750.00');
      expect(res.body.data.category).toBe('CLEANING');

      // Attempt to alter propertyId or maintenanceRequestId is rejected by .strict()
      const rejected = await request(app)
        .patch(`/api/expenses/${EXPENSE_ID}`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({
          propertyId: PROPERTY_ID,
        });

      expect(rejected.status).toBe(400);
    });

    it('deletes expense, cascading to storage object and media_assets row', async () => {
      mockAuth(OWNER_USER);

      prisma.property_expenses.findUnique.mockResolvedValue({
        id: EXPENSE_ID,
        receipt_url: 'receipts/path/test.png',
        properties: { owner_id: OWNER_USER.id },
      });

      prisma.property_expenses.delete.mockResolvedValue({ id: EXPENSE_ID });

      const res = await request(app)
        .delete(`/api/expenses/${EXPENSE_ID}`)
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Expense deleted successfully');
      expect(storageService.deleteFile).toHaveBeenCalledWith('receipts', 'receipts/path/test.png');
      expect(prisma.media_assets.deleteMany).toHaveBeenCalledWith({
        where: { storage_path: 'receipts/path/test.png' },
      });
      expect(prisma.property_expenses.delete).toHaveBeenCalledWith({
        where: { id: EXPENSE_ID },
      });
    });
  });

  describe('7. Receipt Upload & Magic Byte Verification', () => {
    it('rejects SVG file upload with 400 INVALID_FILE_TYPE', async () => {
      mockAuth(OWNER_USER);

      prisma.property_expenses.findUnique.mockResolvedValue({
        id: EXPENSE_ID,
        property_id: PROPERTY_ID,
        properties: { owner_id: OWNER_USER.id },
      });

      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle /></svg>');

      const res = await request(app)
        .post(`/api/expenses/${EXPENSE_ID}/receipt`)
        .set('Authorization', authHeader(OWNER_USER))
        .attach('file', svgBuffer, 'vector.svg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
      expect(storageService.uploadPrivateFile).not.toHaveBeenCalled();
    });

    it('accepts valid PDF file, uploads to private bucket, and deletes old receipt on replacement', async () => {
      mockAuth(OWNER_USER);

      prisma.property_expenses.findUnique.mockResolvedValue({
        id: EXPENSE_ID,
        property_id: PROPERTY_ID,
        receipt_url: 'old/receipt.png',
        properties: { owner_id: OWNER_USER.id },
      });

      prisma.$transaction.mockResolvedValue([{}, {}]);
      storageService.getSignedUrl.mockResolvedValue('https://storage.supabase.co/signed-receipt.pdf');

      const pdfBuffer = Buffer.from('%PDF-1.4 sample pdf document binary content');

      const res = await request(app)
        .post(`/api/expenses/${EXPENSE_ID}/receipt`)
        .set('Authorization', authHeader(OWNER_USER))
        .attach('file', pdfBuffer, 'invoice.pdf');

      expect(res.status).toBe(200);
      expect(res.body.data.receiptUrl).toBe('https://storage.supabase.co/signed-receipt.pdf');
      expect(storageService.uploadPrivateFile).toHaveBeenCalled();
      // Old receipt removed
      expect(storageService.deleteFile).toHaveBeenCalledWith('receipts', 'old/receipt.png');
      expect(prisma.media_assets.deleteMany).toHaveBeenCalledWith({
        where: { storage_path: 'old/receipt.png' },
      });
    });

    it('cleans up uploaded file in storage if database transaction fails', async () => {
      mockAuth(OWNER_USER);

      prisma.property_expenses.findUnique.mockResolvedValue({
        id: EXPENSE_ID,
        property_id: PROPERTY_ID,
        receipt_url: null,
        properties: { owner_id: OWNER_USER.id },
      });

      prisma.$transaction.mockRejectedValue(new Error('DB connection dropped'));

      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      ]);

      const res = await request(app)
        .post(`/api/expenses/${EXPENSE_ID}/receipt`)
        .set('Authorization', authHeader(OWNER_USER))
        .attach('file', pngBuffer, 'receipt.png');

      expect(res.status).toBe(500);
      expect(storageService.deleteFile).toHaveBeenCalled();
    });
  });

  describe('8. POST /api/maintenance-requests/:id/expense (Record from Maintenance Job)', () => {
    it('records expense from COMPLETED job taking FOR UPDATE row lock', async () => {
      mockAuth(OWNER_USER);

      prisma.maintenance_requests.findUnique.mockResolvedValue({
        id: JOB_ID,
        property_id: PROPERTY_ID,
        properties: { owner_id: OWNER_USER.id },
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([
            {
              id: JOB_ID,
              property_id: PROPERTY_ID,
              status: 'COMPLETED',
              actual_cost: new Prisma.Decimal('450.00'),
              title: 'Fix Plumbing Leak',
            },
          ]),
          properties: {
            findUnique: vi.fn().mockResolvedValue({
              id: PROPERTY_ID,
              owner_id: OWNER_USER.id,
            }),
          },
          property_expenses: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: EXPENSE_ID,
              property_id: PROPERTY_ID,
              added_by: OWNER_USER.id,
              maintenance_request_id: JOB_ID,
              category: 'MAINTENANCE',
              description: 'Fix Plumbing Leak (Maintenance Job)',
              amount: new Prisma.Decimal('450.00'),
              incurred_on: new Date('2026-10-14T00:00:00.000Z'),
              receipt_url: null,
              created_at: new Date('2026-10-14T10:00:00.000Z'),
              maintenance_requests: { title: 'Fix Plumbing Leak' },
            }),
          },
        };
        return callback(txMock);
      });

      const res = await request(app)
        .post(`/api/maintenance-requests/${JOB_ID}/expense`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({
          incurredOn: '2026-10-14',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe('450.00');
      expect(res.body.data.category).toBe('MAINTENANCE');
    });

    it('rejects recording expense when job is NOT completed (409 NOT_COMPLETED)', async () => {
      mockAuth(OWNER_USER);

      prisma.maintenance_requests.findUnique.mockResolvedValue({
        id: JOB_ID,
        property_id: PROPERTY_ID,
        properties: { owner_id: OWNER_USER.id },
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([
            {
              id: JOB_ID,
              property_id: PROPERTY_ID,
              status: 'IN_PROGRESS',
              actual_cost: null,
              title: 'Fix Plumbing Leak',
            },
          ]),
        };
        return callback(txMock);
      });

      const res = await request(app)
        .post(`/api/maintenance-requests/${JOB_ID}/expense`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NOT_COMPLETED');
    });

    it('rejects second expense recording with 409 EXPENSE_EXISTS', async () => {
      mockAuth(OWNER_USER);

      prisma.maintenance_requests.findUnique.mockResolvedValue({
        id: JOB_ID,
        property_id: PROPERTY_ID,
        properties: { owner_id: OWNER_USER.id },
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([
            {
              id: JOB_ID,
              property_id: PROPERTY_ID,
              status: 'COMPLETED',
              actual_cost: new Prisma.Decimal('450.00'),
              title: 'Fix Plumbing Leak',
            },
          ]),
          properties: {
            findUnique: vi.fn().mockResolvedValue({
              id: PROPERTY_ID,
              owner_id: OWNER_USER.id,
            }),
          },
          property_expenses: {
            findFirst: vi.fn().mockResolvedValue({ id: EXPENSE_ID }),
          },
        };
        return callback(txMock);
      });

      const res = await request(app)
        .post(`/api/maintenance-requests/${JOB_ID}/expense`)
        .set('Authorization', authHeader(OWNER_USER))
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EXPENSE_EXISTS');
    });

    it('returns 404 for CUSTOMER and PROVIDER', async () => {
      mockAuth(PROVIDER_USER);

      const res = await request(app)
        .post(`/api/maintenance-requests/${JOB_ID}/expense`)
        .set('Authorization', authHeader(PROVIDER_USER))
        .send({});

      expect(res.status).toBe(404);
    });
  });

  describe('9. Maintenance Request Detail Visibility (linkedExpenseId)', () => {
    it('reveals linkedExpenseId to OWNER and ADMIN, but NEVER to PROVIDER', async () => {
      const mockReqRecord = {
        id: JOB_ID,
        property_id: PROPERTY_ID,
        requested_by: OWNER_USER.id,
        provider_id: PROVIDER_USER.id,
        category_id: 'cat-id',
        space_id: null,
        title: 'Roof Repair',
        description: 'Fix tiles',
        priority: 'MEDIUM',
        status: 'COMPLETED',
        scheduled_at: null,
        estimated_cost: new Prisma.Decimal('500.00'),
        actual_cost: new Prisma.Decimal('450.00'),
        completed_at: new Date('2026-10-15T00:00:00.000Z'),
        created_at: new Date('2026-10-10T00:00:00.000Z'),
        updated_at: new Date('2026-10-15T00:00:00.000Z'),
        properties: {
          id: PROPERTY_ID,
          title: 'Sunset Villa',
          owner_id: OWNER_USER.id,
          address_line1: '123 Main St',
          address_line2: null,
          city: 'Mumbai',
          state: 'MH',
          postal_code: '400001',
          profiles: { phone: '+919876543210' },
        },
        spaces: null,
        service_categories: { id: 'cat-id', name: 'Roofing' },
        service_providers: {
          id: 'sp-id',
          business_name: 'Roof Masters',
          profile_id: PROVIDER_USER.id,
          profiles: { phone: '+919876543213' },
        },
        provider_reviews: null,
        maintenance_updates: [],
      };

      // 1. As OWNER
      mockAuth(OWNER_USER);
      prisma.maintenance_requests.findUnique.mockResolvedValue(mockReqRecord);
      prisma.property_expenses.findFirst.mockResolvedValue({ id: EXPENSE_ID });

      let res = await request(app)
        .get(`/api/maintenance-requests/${JOB_ID}`)
        .set('Authorization', authHeader(OWNER_USER));

      expect(res.status).toBe(200);
      expect(res.body.data.linkedExpenseId).toBe(EXPENSE_ID);

      // 2. As PROVIDER
      mockAuth(PROVIDER_USER);
      prisma.maintenance_requests.findUnique.mockResolvedValue(mockReqRecord);

      res = await request(app)
        .get(`/api/maintenance-requests/${JOB_ID}`)
        .set('Authorization', authHeader(PROVIDER_USER));

      expect(res.status).toBe(200);
      expect(res.body.data.linkedExpenseId).toBeUndefined();
    });
  });
});
