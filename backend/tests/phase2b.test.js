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
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    properties: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    spaces: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
    },
    favorites: {
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    bookings: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    property_media: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    space_media: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    media_assets: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    space_reviews: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((fnOrArray) => {
      if (Array.isArray(fnOrArray)) {
        return Promise.all(fnOrArray);
      }
      return fnOrArray(prisma);
    }),
  },
}));

vi.mock('../src/services/storage.service.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    storageService: {
      uploadPublicFile: vi.fn().mockResolvedValue('https://storage.example.com/file.png'),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      getSignedUrl: vi.fn().mockResolvedValue('https://storage.example.com/signed.png'),
    },
  };
});

// Minimal 1x1 valid PNG buffer for file upload tests
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe('Phase 2B Tests', () => {
  const ownerId = '33333333-3333-4333-8333-333333333333';
  const otherOwnerId = '44444444-4444-4444-8444-444444444444';
  const customerId = '55555555-5555-4555-8555-555555555555';
  const propertyId = '11111111-1111-4111-8111-111111111111';
  const spaceId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- 1. Property Authorization & Validation ---
  it('owner can create a property', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: ownerId, email: 'owner@nexora.com' } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: ownerId,
      email: 'owner@nexora.com',
      role: 'OWNER',
      name: 'Owner User',
      is_active: true,
    });

    prisma.properties.create.mockResolvedValueOnce({
      id: propertyId,
      owner_id: ownerId,
      title: 'Valid Property Title',
      property_type: 'APARTMENT',
      address_line1: '123 Test St',
      city: 'Bengaluru',
      state: 'Karnataka',
      postal_code: '560001',
      country: 'India',
      status: 'ACTIVE',
    });

    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', 'Bearer owner-token-1')
      .send({
        title: 'Valid Property Title',
        propertyType: 'APARTMENT',
        addressLine1: '123 Test St',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(propertyId);
  });

  it('CUSTOMER gets 403 on property create', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: customerId, email: 'customer@nexora.com' } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: customerId,
      email: 'customer@nexora.com',
      role: 'CUSTOMER',
      name: 'Customer User',
      is_active: true,
    });

    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', 'Bearer cust-token-1')
      .send({
        title: 'Valid Property Title',
        propertyType: 'APARTMENT',
        addressLine1: '123 Test St',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('ownerId in the body is rejected by strict validation', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: ownerId, email: 'owner@nexora.com' } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: ownerId,
      email: 'owner@nexora.com',
      role: 'OWNER',
      name: 'Owner User',
      is_active: true,
    });

    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', 'Bearer owner-token-2')
      .send({
        title: 'Valid Property Title',
        propertyType: 'APARTMENT',
        addressLine1: '123 Test St',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        ownerId: otherOwnerId, // forbidden
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // --- 2. Ownership & Privacy ---
  it('another owner gets 404 on PATCH/DELETE', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: otherOwnerId, email: 'other@nexora.com' } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValue({
      id: otherOwnerId,
      email: 'other@nexora.com',
      role: 'OWNER',
      name: 'Other Owner',
      is_active: true,
    });

    // Property owned by ownerId
    prisma.properties.findUnique.mockResolvedValue({
      id: propertyId,
      owner_id: ownerId,
      status: 'ACTIVE',
    });

    const patchRes = await request(app)
      .patch(`/api/properties/${propertyId}`)
      .set('Authorization', 'Bearer other-owner-token')
      .send({ title: 'Hacked Title' });

    expect(patchRes.status).toBe(404);
    expect(patchRes.body.error.code).toBe('NOT_FOUND');

    const delRes = await request(app)
      .delete(`/api/properties/${propertyId}`)
      .set('Authorization', 'Bearer other-owner-token');

    expect(delRes.status).toBe(404);
    expect(delRes.body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE sets INACTIVE and does not remove the row', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: ownerId, email: 'owner@nexora.com' } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValueOnce({
      id: ownerId,
      email: 'owner@nexora.com',
      role: 'OWNER',
      name: 'Owner User',
      is_active: true,
    });

    prisma.properties.findUnique.mockResolvedValueOnce({
      id: propertyId,
      owner_id: ownerId,
      status: 'ACTIVE',
    });

    prisma.properties.update.mockResolvedValueOnce({
      id: propertyId,
      owner_id: ownerId,
      status: 'INACTIVE',
    });

    const res = await request(app)
      .delete(`/api/properties/${propertyId}`)
      .set('Authorization', 'Bearer owner-token-3');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('INACTIVE');
  });

  it('public GET hides INACTIVE properties and never exposes owner email/phone', async () => {
    // 1. INACTIVE property returns 404 for public
    prisma.properties.findUnique.mockResolvedValueOnce({
      id: propertyId,
      owner_id: ownerId,
      status: 'INACTIVE',
      profiles: { id: ownerId, name: 'Owner Secret Name' },
      property_media: [],
      spaces: [],
    });

    const resInactive = await request(app).get(`/api/properties/${propertyId}`);
    expect(resInactive.status).toBe(404);

    // 2. ACTIVE property returns owner name only
    prisma.properties.findUnique.mockResolvedValueOnce({
      id: propertyId,
      owner_id: ownerId,
      status: 'ACTIVE',
      title: 'Public Active House',
      profiles: { id: ownerId, name: 'Owner Public Name' },
      property_media: [],
      spaces: [],
    });

    const resActive = await request(app).get(`/api/properties/${propertyId}`);
    expect(resActive.status).toBe(200);
    expect(resActive.body.data.owner.name).toBe('Owner Public Name');
    expect(resActive.body.data.owner.email).toBeUndefined();
    expect(resActive.body.data.owner.phone).toBeUndefined();
  });

  // --- 3. Space Search & Decimals ---
  it('search returns only AVAILABLE spaces in ACTIVE properties with decimal pricing and pagination meta', async () => {
    prisma.spaces.count.mockResolvedValueOnce(1);
    prisma.spaces.findMany.mockResolvedValueOnce([
      {
        id: spaceId,
        name: 'Desk 1',
        space_type: 'OFFICE',
        capacity: 2,
        price_amount: new Prisma.Decimal('150.50'),
        price_unit: 'HOUR',
        properties: { id: propertyId, title: 'Office Park', city: 'Bengaluru', state: 'KA' },
        space_media: [],
      },
    ]);
    prisma.space_reviews.groupBy.mockResolvedValueOnce([
      { space_id: spaceId, _avg: { rating: 4.8 }, _count: { rating: 12 } },
    ]);

    const res = await request(app).get('/api/spaces?minPrice=100&sort=price_asc');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].priceAmount).toBe('150.50');
    expect(res.body.data[0].averageRating).toBe(4.8);
    expect(res.body.data[0].reviewCount).toBe(12);
    expect(res.body.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  // --- 4. Favorites Idempotency ---
  it('favorites add is idempotent and favorite of hidden space returns 404', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: customerId, email: 'cust@nexora.com' } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValue({
      id: customerId,
      email: 'cust@nexora.com',
      role: 'CUSTOMER',
      name: 'Customer User',
      is_active: true,
    });

    // 1. Hidden space returns 404
    prisma.spaces.findUnique.mockResolvedValueOnce({
      id: spaceId,
      status: 'UNAVAILABLE',
      properties: { status: 'ACTIVE' },
    });

    const resHidden = await request(app)
      .put(`/api/favorites/${spaceId}`)
      .set('Authorization', 'Bearer cust-token-2');

    expect(resHidden.status).toBe(404);

    // 2. Public space succeeds
    prisma.spaces.findUnique.mockResolvedValueOnce({
      id: spaceId,
      status: 'AVAILABLE',
      properties: { status: 'ACTIVE' },
    });
    prisma.favorites.upsert.mockResolvedValueOnce({
      customer_id: customerId,
      space_id: spaceId,
    });

    const resAdd = await request(app)
      .put(`/api/favorites/${spaceId}`)
      .set('Authorization', 'Bearer cust-token-2');

    expect(resAdd.status).toBe(200);
    expect(resAdd.body.data.favorited).toBe(true);

    // 3. Remove favorite succeeds idempotently
    prisma.favorites.deleteMany.mockResolvedValueOnce({ count: 1 });

    const resDel = await request(app)
      .delete(`/api/favorites/${spaceId}`)
      .set('Authorization', 'Bearer cust-token-2');

    expect(resDel.status).toBe(200);
    expect(resDel.body.data.favorited).toBe(false);
  });

  // --- 5. Image Upload & Magic Bytes ---
  it('upload rejects SVG or files with mismatched magic bytes', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: ownerId, email: 'owner@nexora.com' } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValue({
      id: ownerId,
      email: 'owner@nexora.com',
      role: 'OWNER',
      name: 'Owner User',
      is_active: true,
    });

    prisma.properties.findUnique.mockResolvedValue({
      id: propertyId,
      owner_id: ownerId,
      _count: { property_media: 0 },
    });

    // Attempt to upload SVG
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>');
    const resSvg = await request(app)
      .post(`/api/properties/${propertyId}/media`)
      .set('Authorization', 'Bearer owner-token-4')
      .attach('file', svgBuffer, 'image.svg');

    expect(resSvg.status).toBe(400);
    expect(resSvg.body.error.code).toBe('INVALID_FILE_TYPE');

    // Attempt to upload fake text file renamed to .png
    const fakeBuffer = Buffer.from('this is plain text pretending to be png');
    const resFake = await request(app)
      .post(`/api/properties/${propertyId}/media`)
      .set('Authorization', 'Bearer owner-token-4')
      .attach('file', fakeBuffer, 'fake.png');

    expect(resFake.status).toBe(400);
    expect(resFake.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('11th image returns 409 conflict and failed DB write triggers storage cleanup', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: ownerId, email: 'owner@nexora.com' } },
      error: null,
    });
    prisma.profiles.findUnique.mockResolvedValue({
      id: ownerId,
      email: 'owner@nexora.com',
      role: 'OWNER',
      name: 'Owner User',
      is_active: true,
    });

    // 1. 10 images exist -> 11th triggers 409
    prisma.properties.findUnique.mockResolvedValueOnce({
      id: propertyId,
      owner_id: ownerId,
      _count: { property_media: 10 },
    });

    const resFull = await request(app)
      .post(`/api/properties/${propertyId}/media`)
      .set('Authorization', 'Bearer owner-token-5')
      .attach('file', VALID_PNG_BUFFER, 'valid.png');

    expect(resFull.status).toBe(409);
    expect(resFull.body.error.code).toBe('CONFLICT');

    // 2. DB write fails -> triggers deleteFile cleanup
    prisma.properties.findUnique.mockResolvedValueOnce({
      id: propertyId,
      owner_id: ownerId,
      _count: { property_media: 5 },
    });
    prisma.$transaction.mockRejectedValueOnce(new Error('Simulated DB failure'));

    const resFail = await request(app)
      .post(`/api/properties/${propertyId}/media`)
      .set('Authorization', 'Bearer owner-token-5')
      .attach('file', VALID_PNG_BUFFER, 'valid.png');

    expect(resFail.status).toBe(500);
    expect(storageService.deleteFile).toHaveBeenCalled();
  });
});
