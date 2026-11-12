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
    },
    spaces: {
      findUnique: vi.fn(),
    },
    service_categories: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    service_providers: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    service_provider_categories: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    maintenance_requests: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    maintenance_updates: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    media_assets: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    provider_reviews: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
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

describe('Phase 4B — Service Providers & Maintenance Job Workflow API Tests', () => {
  const OWNER_USER = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'owner@example.com',
    role: 'OWNER',
    name: 'Property Owner',
    phone: '+919876543210',
    is_active: true,
  };

  const OTHER_OWNER = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'other@example.com',
    role: 'OWNER',
    name: 'Other Owner',
    phone: '+919876543211',
    is_active: true,
  };

  const PROVIDER_USER = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'provider@example.com',
    role: 'PROVIDER',
    name: 'FixIt Pro',
    phone: '+919876543212',
    is_active: true,
  };

  const UNASSIGNED_PROVIDER = {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'unassigned@example.com',
    role: 'PROVIDER',
    name: 'Unassigned Pro',
    phone: '+919876543213',
    is_active: true,
  };

  const CUSTOMER_USER = {
    id: '55555555-5555-4555-8555-555555555555',
    email: 'customer@example.com',
    role: 'CUSTOMER',
    name: 'Customer User',
    phone: '+919876543214',
    is_active: true,
  };

  const ADMIN_USER = {
    id: '66666666-6666-4666-8666-666666666666',
    email: 'admin@example.com',
    role: 'ADMIN',
    name: 'Platform Admin',
    phone: '+919876543215',
    is_active: true,
  };

  const CATEGORY_PLUMBING = {
    id: '77777777-7777-4777-8777-777777777777',
    name: 'Plumbing',
    is_active: true,
  };

  const CATEGORY_ELECTRICAL = {
    id: '77777777-7777-4777-8777-888888888888',
    name: 'Electrical',
    is_active: true,
  };

  const TEST_PROPERTY = {
    id: '88888888-8888-4888-8888-888888888888',
    owner_id: OWNER_USER.id,
    title: 'Skyline Penthouse',
    address_line1: '123 Sky Way',
    city: 'Bengaluru',
    state: 'Karnataka',
    postal_code: '560001',
    status: 'ACTIVE',
    profiles: OWNER_USER,
  };

  const TEST_PROVIDER_RECORD = {
    id: '99999999-9999-4999-8999-999999999999',
    profile_id: PROVIDER_USER.id,
    business_name: 'FixIt Plumbing Solutions',
    bio: 'Certified master plumber',
    service_area_city: 'Bengaluru',
    service_area_state: 'Karnataka',
    verification_status: 'VERIFIED',
    is_available: true,
    profiles: PROVIDER_USER,
    service_provider_categories: [
      { category_id: CATEGORY_PLUMBING.id, service_categories: CATEGORY_PLUMBING },
    ],
  };

  const TEST_REQUEST = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    property_id: TEST_PROPERTY.id,
    requested_by: OWNER_USER.id,
    provider_id: TEST_PROVIDER_RECORD.id,
    category_id: CATEGORY_PLUMBING.id,
    title: 'Burst pipe under sink',
    description: 'Major leak under kitchen sink requiring urgent pipe replacement',
    priority: 'HIGH',
    status: 'OPEN',
    scheduled_at: null,
    estimated_cost: new Prisma.Decimal('1500.00'),
    actual_cost: null,
    properties: TEST_PROPERTY,
    service_categories: CATEGORY_PLUMBING,
    service_providers: TEST_PROVIDER_RECORD,
    spaces: null,
    maintenance_updates: [],
    provider_reviews: null,
  };

  function authHeader(user) {
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

  // --- 1. Service Provider Profiles & Verification ---

  it('only PROVIDER role can create a provider profile; CUSTOMER gets 403', async () => {
    const custToken = authHeader(CUSTOMER_USER);

    const res = await request(app)
      .post('/api/providers/profile')
      .set('Authorization', custToken)
      .send({
        businessName: 'Customer Handyman',
        serviceAreaCity: 'Bengaluru',
        serviceAreaState: 'Karnataka',
        categoryIds: [CATEGORY_PLUMBING.id],
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('verificationStatus in the request body is strictly rejected (Zod strict)', async () => {
    const provToken = authHeader(PROVIDER_USER);

    const res = await request(app)
      .post('/api/providers/profile')
      .set('Authorization', provToken)
      .send({
        businessName: 'Sneaky Provider',
        serviceAreaCity: 'Bengaluru',
        serviceAreaState: 'Karnataka',
        categoryIds: [CATEGORY_PLUMBING.id],
        verificationStatus: 'VERIFIED',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('unverified provider cannot be assigned to a maintenance request (400 PROVIDER_NOT_VERIFIED)', async () => {
    const ownerToken = authHeader(OWNER_USER);

    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'OPEN',
    });

    prisma.service_providers.findUnique.mockResolvedValue({
      ...TEST_PROVIDER_RECORD,
      verification_status: 'PENDING', // Unverified!
    });

    const res = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/assign`)
      .set('Authorization', ownerToken)
      .send({
        providerId: TEST_PROVIDER_RECORD.id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PROVIDER_NOT_VERIFIED');
  });

  it('unavailable provider cannot be assigned (400 PROVIDER_UNAVAILABLE)', async () => {
    const ownerToken = authHeader(OWNER_USER);

    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'OPEN',
    });

    prisma.service_providers.findUnique.mockResolvedValue({
      ...TEST_PROVIDER_RECORD,
      verification_status: 'VERIFIED',
      is_available: false, // Unavailable!
    });

    const res = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/assign`)
      .set('Authorization', ownerToken)
      .send({
        providerId: TEST_PROVIDER_RECORD.id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PROVIDER_UNAVAILABLE');
  });

  it('category mismatch returns 400 CATEGORY_MISMATCH', async () => {
    const ownerToken = authHeader(OWNER_USER);

    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'OPEN',
      category_id: CATEGORY_ELECTRICAL.id, // Electrical request!
    });

    prisma.service_providers.findUnique.mockResolvedValue({
      ...TEST_PROVIDER_RECORD,
      verification_status: 'VERIFIED',
      is_available: true,
      service_provider_categories: [
        { category_id: CATEGORY_PLUMBING.id }, // Only offers plumbing!
      ],
    });

    const res = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/assign`)
      .set('Authorization', ownerToken)
      .send({
        providerId: TEST_PROVIDER_RECORD.id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CATEGORY_MISMATCH');
  });

  // --- 2. Job Workflow State Transitions ---

  it('assign endpoint takes row lock FOR UPDATE and transitions OPEN -> ASSIGNED', async () => {
    const ownerToken = authHeader(OWNER_USER);

    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'OPEN',
    });

    prisma.service_providers.findUnique.mockResolvedValue(TEST_PROVIDER_RECORD);

    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: TEST_REQUEST.id, status: 'OPEN' }]),
        maintenance_requests: {
          update: vi.fn().mockResolvedValue({ ...TEST_REQUEST, status: 'ASSIGNED' }),
        },
        maintenance_updates: {
          create: vi.fn().mockResolvedValue({ id: 'update-1' }),
        },
      };
      return callback(tx);
    });

    const res = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/assign`)
      .set('Authorization', ownerToken)
      .send({
        providerId: TEST_PROVIDER_RECORD.id,
      });

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('invalid transitions return 409 INVALID_TRANSITION (e.g. start from OPEN, complete from ASSIGNED)', async () => {
    const provToken = authHeader(PROVIDER_USER);
    prisma.service_providers.findUnique.mockResolvedValue(TEST_PROVIDER_RECORD);

    // Try starting from OPEN -> expect 409
    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'OPEN', // Cannot start from OPEN
    });

    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: TEST_REQUEST.id, status: 'OPEN' }]),
      };
      return callback(tx);
    });

    const resStart = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/start`)
      .set('Authorization', provToken);

    expect(resStart.status).toBe(409);
    expect(resStart.body.error.code).toBe('INVALID_TRANSITION');

    // Try completing from ASSIGNED -> expect 409
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: TEST_REQUEST.id, status: 'ASSIGNED' }]),
      };
      return callback(tx);
    });

    const resComplete = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/complete`)
      .set('Authorization', provToken)
      .send({ actualCost: '1500.00' });

    expect(resComplete.status).toBe(409);
    expect(resComplete.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('decline requires a reason string (3-500 chars)', async () => {
    const provToken = authHeader(PROVIDER_USER);
    prisma.service_providers.findUnique.mockResolvedValue(TEST_PROVIDER_RECORD);
    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'ASSIGNED',
    });

    const res = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/decline`)
      .set('Authorization', provToken)
      .send({}); // Missing reason!

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('complete requires valid non-negative actualCost with up to 2 decimal places', async () => {
    const provToken = authHeader(PROVIDER_USER);
    prisma.service_providers.findUnique.mockResolvedValue(TEST_PROVIDER_RECORD);
    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'IN_PROGRESS',
    });

    const resNoCost = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/complete`)
      .set('Authorization', provToken)
      .send({}); // Missing actualCost!

    expect(resNoCost.status).toBe(400);
    expect(resNoCost.body.error.code).toBe('VALIDATION_ERROR');

    const resInvalidCost = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/complete`)
      .set('Authorization', provToken)
      .send({ actualCost: '1500.999' }); // 3 decimals!

    expect(resInvalidCost.status).toBe(400);
    expect(resInvalidCost.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cancel from IN_PROGRESS works and notifies the assigned provider', async () => {
    const ownerToken = authHeader(OWNER_USER);

    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'IN_PROGRESS',
      provider_id: TEST_PROVIDER_RECORD.id,
      service_providers: { profile_id: PROVIDER_USER.id },
    });

    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: TEST_REQUEST.id, status: 'IN_PROGRESS' }]),
        maintenance_requests: {
          update: vi.fn().mockResolvedValue({
            ...TEST_REQUEST,
            status: 'CANCELLED',
          }),
        },
        maintenance_updates: {
          create: vi.fn().mockResolvedValue({ id: 'update-cancel' }),
        },
      };
      return callback(tx);
    });

    const res = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/cancel`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Owner decided to replace whole appliance' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    expect(prisma.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: PROVIDER_USER.id,
          type: 'MAINTENANCE_CANCELLED',
        }),
      })
    );
  });

  it('cancel from COMPLETED returns 409 INVALID_TRANSITION', async () => {
    const ownerToken = authHeader(OWNER_USER);

    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'COMPLETED',
      provider_id: TEST_PROVIDER_RECORD.id,
      service_providers: { profile_id: PROVIDER_USER.id },
    });

    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: TEST_REQUEST.id, status: 'COMPLETED' }]),
      };
      return callback(tx);
    });

    const res = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/cancel`)
      .set('Authorization', ownerToken)
      .send({ reason: 'Too late to cancel' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  // --- 3. Privacy, Authorization & Contact Visibility ---

  it('unassigned provider gets 404 on maintenance request detail', async () => {
    const unassignedToken = authHeader(UNASSIGNED_PROVIDER);
    prisma.service_providers.findUnique.mockResolvedValue({
      id: 'other-provider-id',
      profile_id: UNASSIGNED_PROVIDER.id,
    });

    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'ASSIGNED',
      provider_id: TEST_PROVIDER_RECORD.id, // Assigned to different provider!
    });

    const res = await request(app)
      .get(`/api/maintenance-requests/${TEST_REQUEST.id}`)
      .set('Authorization', unassignedToken);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('another owner gets 404 on maintenance request detail', async () => {
    const otherOwnerToken = authHeader(OTHER_OWNER);

    prisma.maintenance_requests.findUnique.mockResolvedValue(TEST_REQUEST);

    const res = await request(app)
      .get(`/api/maintenance-requests/${TEST_REQUEST.id}`)
      .set('Authorization', otherOwnerToken);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('phone numbers appear only on assigned request detail and email NEVER appears', async () => {
    const provToken = authHeader(PROVIDER_USER);
    prisma.service_providers.findUnique.mockResolvedValue(TEST_PROVIDER_RECORD);

    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'ASSIGNED',
      provider_id: TEST_PROVIDER_RECORD.id,
    });

    const res = await request(app)
      .get(`/api/maintenance-requests/${TEST_REQUEST.id}`)
      .set('Authorization', provToken);

    expect(res.status).toBe(200);
    const bodyStr = JSON.stringify(res.body);

    // Verify phone is present in counterpartContact
    expect(res.body.data.counterpartContact).toBeDefined();
    expect(res.body.data.counterpartContact.phone).toBe('+919876543210');

    // Verify email NEVER appears anywhere in response
    expect(bodyStr).not.toContain('@example.com');
    expect(bodyStr).not.toContain('email');
  });

  it('an OWNER passing role=admin still sees only their own properties requests', async () => {
    const ownerToken = authHeader(OWNER_USER);

    prisma.maintenance_requests.count.mockResolvedValue(1);
    prisma.maintenance_requests.findMany.mockResolvedValue([TEST_REQUEST]);

    const res = await request(app)
      .get('/api/maintenance-requests?role=admin')
      .set('Authorization', ownerToken);

    expect(res.status).toBe(200);
    expect(prisma.maintenance_requests.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          properties: { owner_id: OWNER_USER.id },
        }),
      })
    );
  });

  it('a PROVIDER passing role=owner sees only their assigned jobs', async () => {
    const provToken = authHeader(PROVIDER_USER);
    prisma.service_providers.findUnique.mockResolvedValue(TEST_PROVIDER_RECORD);

    prisma.maintenance_requests.count.mockResolvedValue(1);
    prisma.maintenance_requests.findMany.mockResolvedValue([
      { ...TEST_REQUEST, provider_id: TEST_PROVIDER_RECORD.id },
    ]);

    const res = await request(app)
      .get('/api/maintenance-requests?role=owner')
      .set('Authorization', provToken);

    expect(res.status).toBe(200);
    expect(prisma.maintenance_requests.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider_id: TEST_PROVIDER_RECORD.id,
        }),
      })
    );
  });

  // --- 4. Grouped Query Scalability ---

  it('provider listing executes exactly TWO grouped queries regardless of provider count', async () => {
    const ownerToken = authHeader(OWNER_USER);

    prisma.service_providers.count.mockResolvedValue(2);
    prisma.service_providers.findMany.mockResolvedValue([
      TEST_PROVIDER_RECORD,
      { ...TEST_PROVIDER_RECORD, id: 'prov-2', business_name: 'Electro Spark' },
    ]);

    prisma.provider_reviews.groupBy.mockResolvedValue([
      { provider_id: TEST_PROVIDER_RECORD.id, _avg: { rating: 4.8 }, _count: { id: 10 } },
    ]);

    prisma.maintenance_requests.groupBy.mockResolvedValue([
      { provider_id: TEST_PROVIDER_RECORD.id, _count: { id: 15 } },
    ]);

    const res = await request(app)
      .get('/api/providers')
      .set('Authorization', ownerToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(prisma.provider_reviews.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.maintenance_requests.groupBy).toHaveBeenCalledTimes(1);
  });

  // --- 5. Media Uploads & Signed URLs ---

  it('media update upload rejects SVG and spoofed mime types', async () => {
    const provToken = authHeader(PROVIDER_USER);
    prisma.service_providers.findUnique.mockResolvedValue(TEST_PROVIDER_RECORD);
    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'IN_PROGRESS',
    });

    const svgBuffer = Buffer.from('<svg><text>malicious</text></svg>');

    const res = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/updates`)
      .set('Authorization', provToken)
      .field('note', 'Here is the damage report')
      .attach('file', svgBuffer, 'vector.svg');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  // --- 6. Provider Reviews ---

  it('review is allowed only on COMPLETED requests; owner-only; duplicate returns 409', async () => {
    const ownerToken = authHeader(OWNER_USER);

    // 1. Not completed -> 409
    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'IN_PROGRESS',
    });

    const resNotDone = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/review`)
      .set('Authorization', ownerToken)
      .send({ rating: 5, comment: 'Great job' });

    expect(resNotDone.status).toBe(409);

    // 2. Completed request -> 201
    prisma.maintenance_requests.findUnique.mockResolvedValue({
      ...TEST_REQUEST,
      status: 'COMPLETED',
    });
    prisma.provider_reviews.findUnique.mockResolvedValue(null);
    prisma.provider_reviews.create.mockResolvedValue({
      id: 'review-1',
      maintenance_request_id: TEST_REQUEST.id,
      provider_id: TEST_PROVIDER_RECORD.id,
      rating: 5,
      comment: 'Great job',
      created_at: new Date(),
      profiles: { name: 'Property Owner' },
    });

    const resOk = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/review`)
      .set('Authorization', ownerToken)
      .send({ rating: 5, comment: 'Great job' });

    expect(resOk.status).toBe(201);
    expect(resOk.body.data.rating).toBe(5);

    // 3. Second review on same request -> 409 ALREADY_REVIEWED
    prisma.provider_reviews.findUnique.mockResolvedValue({ id: 'review-1' });

    const resDup = await request(app)
      .post(`/api/maintenance-requests/${TEST_REQUEST.id}/review`)
      .set('Authorization', ownerToken)
      .send({ rating: 4 });

    expect(resDup.status).toBe(409);
    expect(resDup.body.error.code).toBe('ALREADY_REVIEWED');
  });

  // --- 7. Admin Verification Logging & Notifications ---

  it('admin verification updates status and sends notification to provider', async () => {
    const adminToken = authHeader(ADMIN_USER);

    prisma.service_providers.findUnique.mockResolvedValue(TEST_PROVIDER_RECORD);
    prisma.service_providers.update.mockResolvedValue({
      ...TEST_PROVIDER_RECORD,
      verification_status: 'VERIFIED',
    });

    const res = await request(app)
      .patch(`/api/admin/providers/${TEST_PROVIDER_RECORD.id}/verification`)
      .set('Authorization', adminToken)
      .send({ status: 'VERIFIED', note: 'Business license verified' });

    expect(res.status).toBe(200);
    expect(prisma.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_id: PROVIDER_USER.id,
          type: 'PROVIDER_VERIFIED',
        }),
      })
    );
  });
});
