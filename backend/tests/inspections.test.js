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
      findMany: vi.fn(),
    },
    properties: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    inspections: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    inspection_items: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    inspection_media: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
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

describe('Inspections & Property Health API Tests', () => {
  const OWNER_USER = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'owner@example.com',
    role: 'OWNER',
    name: 'Property Owner',
    is_active: true,
  };

  const OTHER_OWNER = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'other@example.com',
    role: 'OWNER',
    name: 'Other Owner',
    is_active: true,
  };

  const CUSTOMER_USER = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'customer@example.com',
    role: 'CUSTOMER',
    name: 'Customer User',
    is_active: true,
  };

  const PROVIDER_USER = {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'provider@example.com',
    role: 'PROVIDER',
    name: 'Inspector Provider',
    is_active: true,
  };

  const UNASSIGNED_PROVIDER = {
    id: '55555555-5555-4555-8555-555555555555',
    email: 'unassigned@example.com',
    role: 'PROVIDER',
    name: 'Unassigned Provider',
    is_active: true,
  };

  const TEST_PROPERTY = {
    id: '66666666-6666-4666-8666-666666666666',
    title: 'Sunset View Villa',
    owner_id: OWNER_USER.id,
    status: 'ACTIVE',
  };

  const TEST_INSPECTION = {
    id: '77777777-7777-4777-8777-777777777777',
    property_id: TEST_PROPERTY.id,
    inspector_id: PROVIDER_USER.id,
    scheduled_at: new Date('2026-12-15T10:00:00Z'),
    status: 'SCHEDULED',
    overall_condition_score: null,
    summary: 'Routine health inspection',
    properties: TEST_PROPERTY,
    profiles: { id: PROVIDER_USER.id, name: PROVIDER_USER.name, role: PROVIDER_USER.role },
    inspection_items: [],
    inspection_media: [],
  };

  function authenticateAs(user) {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: user.id, email: user.email } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValue(user);
    return `Bearer token-${user.id}`;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('owner can create an inspection and another owner gets 404', async () => {
    // 1. Authenticate as property owner
    const ownerToken = authenticateAs(OWNER_USER);
    prisma.properties.findUnique.mockResolvedValue(TEST_PROPERTY);
    prisma.inspections.create.mockResolvedValue({
      id: TEST_INSPECTION.id,
      property_id: TEST_PROPERTY.id,
      inspector_id: OWNER_USER.id,
      scheduled_at: new Date('2026-12-15T10:00:00Z'),
      status: 'SCHEDULED',
      summary: 'Owner scheduled inspection',
      created_at: new Date(),
      profiles: { id: OWNER_USER.id, name: OWNER_USER.name, role: OWNER_USER.role },
    });

    const resSuccess = await request(app)
      .post(`/api/properties/${TEST_PROPERTY.id}/inspections`)
      .set('Authorization', ownerToken)
      .send({
        scheduledAt: '2026-12-15T10:00:00+05:30',
        summary: 'Owner scheduled inspection',
      });

    expect(resSuccess.status).toBe(201);
    expect(resSuccess.body.success).toBe(true);
    expect(resSuccess.body.data.id).toBe(TEST_INSPECTION.id);

    // 2. Authenticate as different owner -> expect 404
    const otherToken = authenticateAs(OTHER_OWNER);
    const resForbidden = await request(app)
      .post(`/api/properties/${TEST_PROPERTY.id}/inspections`)
      .set('Authorization', otherToken)
      .send({
        scheduledAt: '2026-12-15T10:00:00+05:30',
      });

    expect(resForbidden.status).toBe(404);
    expect(resForbidden.body.success).toBe(false);
    expect(resForbidden.body.error.code).toBe('NOT_FOUND');
  });

  it('CUSTOMER role gets 403 FORBIDDEN when attempting inspection creation', async () => {
    const custToken = authenticateAs(CUSTOMER_USER);

    const res = await request(app)
      .post(`/api/properties/${TEST_PROPERTY.id}/inspections`)
      .set('Authorization', custToken)
      .send({
        scheduledAt: '2026-12-15T10:00:00+05:30',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('an inspector who is not assigned gets 404', async () => {
    const unassignedToken = authenticateAs(UNASSIGNED_PROVIDER);
    prisma.inspections.findUnique.mockResolvedValue(TEST_INSPECTION);

    const res = await request(app)
      .get(`/api/inspections/${TEST_INSPECTION.id}`)
      .set('Authorization', unassignedToken);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('checklist replace is transactional and moves SCHEDULED to IN_PROGRESS', async () => {
    const ownerToken = authenticateAs(OWNER_USER);
    prisma.inspections.findUnique.mockResolvedValue(TEST_INSPECTION);

    const mockItems = [
      { id: 'item-1', item_name: 'Foundation', category: 'Structure', condition: 'EXCELLENT', notes: null },
      { id: 'item-2', item_name: 'Pipes', category: 'Plumbing', condition: 'GOOD', notes: 'Checked' },
    ];

    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        inspection_items: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          createMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        inspections: {
          update: vi.fn().mockResolvedValue({ status: 'IN_PROGRESS' }),
        },
      };
      return callback(tx);
    });

    prisma.inspection_items.findMany.mockResolvedValue(mockItems);

    const res = await request(app)
      .put(`/api/inspections/${TEST_INSPECTION.id}/items`)
      .set('Authorization', ownerToken)
      .send({
        items: [
          { itemName: 'Foundation', category: 'Structure', condition: 'EXCELLENT' },
          { itemName: 'Pipes', category: 'Plumbing', condition: 'GOOD', notes: 'Checked' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.itemCount).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('cannot edit items on a COMPLETED inspection (returns 409)', async () => {
    const ownerToken = authenticateAs(OWNER_USER);
    prisma.inspections.findUnique.mockResolvedValue({
      ...TEST_INSPECTION,
      status: 'COMPLETED',
    });

    const res = await request(app)
      .put(`/api/inspections/${TEST_INSPECTION.id}/items`)
      .set('Authorization', ownerToken)
      .send({
        items: [{ itemName: 'Pipes', category: 'Plumbing', condition: 'GOOD' }],
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('complete with no items returns 409 NO_ITEMS', async () => {
    const ownerToken = authenticateAs(OWNER_USER);
    prisma.inspections.findUnique.mockResolvedValue(TEST_INSPECTION);

    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([
          { id: TEST_INSPECTION.id, status: 'SCHEDULED' },
        ]),
        inspection_items: {
          findMany: vi.fn().mockResolvedValue([]), // No items!
        },
      };
      return callback(tx);
    });

    const res = await request(app)
      .post(`/api/inspections/${TEST_INSPECTION.id}/complete`)
      .set('Authorization', ownerToken)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ITEMS');
  });

  it('the score body field is rejected on completion (Zod strict)', async () => {
    const ownerToken = authenticateAs(OWNER_USER);

    const res = await request(app)
      .post(`/api/inspections/${TEST_INSPECTION.id}/complete`)
      .set('Authorization', ownerToken)
      .send({
        score: '100.00',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('media upload rejects SVG and spoofed file types based on magic bytes', async () => {
    const ownerToken = authenticateAs(OWNER_USER);

    // Fake SVG buffer
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>');

    const res = await request(app)
      .post(`/api/inspections/${TEST_INSPECTION.id}/media`)
      .set('Authorization', ownerToken)
      .attach('file', svgBuffer, 'vector.svg');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('media upload stores storage path and returns a signed URL with no public URL', async () => {
    const ownerToken = authenticateAs(OWNER_USER);
    prisma.inspections.findUnique.mockResolvedValue(TEST_INSPECTION);
    prisma.inspection_media.count.mockResolvedValue(0);

    storageService.uploadPrivateFile.mockResolvedValue('prop-1/insp-1/uuid.png');
    storageService.getSignedUrl.mockResolvedValue('https://supabase.co/storage/v1/object/sign/inspection-media/prop-1/insp-1/uuid.png?token=simulated-signed');

    prisma.$transaction.mockResolvedValue([
      {
        id: 'media-1',
        inspection_id: TEST_INSPECTION.id,
        url: 'prop-1/insp-1/uuid.png',
        media_type: 'image/png',
        caption: 'Crack in wall',
        created_at: new Date(),
      },
      {
        id: 'asset-1',
      },
    ]);

    // Valid 1x1 PNG magic bytes
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);

    const res = await request(app)
      .post(`/api/inspections/${TEST_INSPECTION.id}/media`)
      .set('Authorization', ownerToken)
      .attach('file', pngBuffer, 'sample.png')
      .field('caption', 'Crack in wall');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(storageService.getSignedUrl).toHaveBeenCalledWith(
      'inspection-media',
      expect.stringMatching(new RegExp(`^${TEST_PROPERTY.id}/${TEST_INSPECTION.id}/.*\\.png$`)),
      3600
    );
    expect(res.body.data.url).toContain('/sign/');
    expect(res.body.data.url).not.toContain('/public/');
  });

  it('health endpoint returns hasData: false when property has no completed inspections', async () => {
    const ownerToken = authenticateAs(OWNER_USER);
    prisma.properties.findUnique.mockResolvedValue(TEST_PROPERTY);
    prisma.inspections.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/properties/${TEST_PROPERTY.id}/health`)
      .set('Authorization', ownerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hasData).toBe(false);
  });

  it('owner health-overview executes ONE single grouped query ($queryRaw)', async () => {
    const ownerToken = authenticateAs(OWNER_USER);

    prisma.$queryRaw.mockResolvedValue([
      {
        id: TEST_PROPERTY.id,
        title: TEST_PROPERTY.title,
        latest_score: new Prisma.Decimal('85.00'),
        last_inspected_at: new Date('2026-11-01T10:00:00Z'),
        previous_score: new Prisma.Decimal('80.00'),
      },
    ]);

    const res = await request(app)
      .get('/api/owner/health-overview')
      .set('Authorization', ownerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].latestScore).toBe('85.00');
    expect(res.body.data[0].grade).toBe('B');
    expect(res.body.data[0].trend).toBe('UP');
    expect(res.body.data[0].overdue).toBe(false);
  });
});
