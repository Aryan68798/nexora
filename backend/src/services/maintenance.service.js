import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { storageService } from './storage.service.js';
import { createNotification } from './notification.service.js';

/**
 * Formats a raw Prisma maintenance_requests record to camelCase JSON response shape.
 * @param {object} r - Raw maintenance request record
 * @returns {object|null}
 */
function formatMaintenanceResponse(r) {
  if (!r) return null;
  return {
    id: r.id,
    propertyId: r.property_id ?? r.propertyId,
    spaceId: r.space_id ?? r.spaceId ?? null,
    requestedBy: r.requested_by ?? r.requestedBy,
    providerId: r.provider_id ?? r.providerId ?? null,
    categoryId: r.category_id ?? r.categoryId ?? null,
    title: r.title,
    description: r.description,
    priority: r.priority,
    status: r.status,
    scheduledAt: r.scheduled_at ?? r.scheduledAt ?? null,
    estimatedCost: r.estimated_cost ?? r.estimatedCost ?? null,
    actualCost: r.actual_cost ?? r.actualCost ?? null,
    completedAt: r.completed_at ?? r.completedAt ?? null,
    createdAt: r.created_at ?? r.createdAt,
    updatedAt: r.updated_at ?? r.updatedAt,
  };
}

/**
 * Creates a new maintenance request.
 * Status is initialized to OPEN.
 * @param {object} user - Authenticated user
 * @param {object} data - Input payload
 * @returns {Promise<object>}
 */
export async function createMaintenanceRequest(user, data) {
  const property = await prisma.properties.findUnique({
    where: { id: data.propertyId },
  });

  if (!property) {
    throw AppError.notFound('Property not found');
  }

  if (user.role !== 'ADMIN' && property.owner_id !== user.id) {
    throw AppError.notFound('Property not found');
  }

  if (data.spaceId) {
    const space = await prisma.spaces.findUnique({
      where: { id: data.spaceId },
    });
    if (!space || space.property_id !== data.propertyId) {
      throw AppError.badRequest('Specified space does not belong to the selected property');
    }
  }

  if (data.categoryId) {
    const cat = await prisma.service_categories.findUnique({
      where: { id: data.categoryId },
    });
    if (!cat || !cat.is_active) {
      throw AppError.badRequest('Selected service category is invalid or inactive');
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const req = await tx.maintenance_requests.create({
      data: {
        property_id: data.propertyId,
        space_id: data.spaceId ?? null,
        requested_by: user.id,
        category_id: data.categoryId ?? null,
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        status: 'OPEN',
        estimated_cost: data.estimatedCost ? new Prisma.Decimal(data.estimatedCost) : null,
        scheduled_at: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
      include: {
        properties: { select: { id: true, title: true, city: true } },
        service_categories: { select: { id: true, name: true } },
      },
    });

    await tx.maintenance_updates.create({
      data: {
        maintenance_request_id: req.id,
        added_by: user.id,
        note: 'Maintenance request created',
      },
    });

    return req;
  });

  return {
    id: created.id,
    propertyId: created.property_id,
    propertyTitle: created.properties?.title,
    city: created.properties?.city,
    spaceId: created.space_id,
    categoryId: created.category_id,
    categoryName: created.service_categories?.name ?? null,
    title: created.title,
    description: created.description,
    priority: created.priority,
    status: created.status,
    estimatedCost: created.estimated_cost,
    scheduledAt: created.scheduled_at,
    createdAt: created.created_at,
  };
}

/**
 * Lists maintenance requests with role-based visibility and filters.
 * The caller's scope is strictly determined by their authenticated profile role (user.role).
 * Any role query parameter is completely ignored to prevent privilege escalation.
 * @param {object} user - Authenticated user
 * @param {object} query - Filter options
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export async function listMaintenanceRequests(user, query) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where = {};

  if (user.role === 'OWNER') {
    where.properties = { owner_id: user.id };
  } else if (user.role === 'PROVIDER') {
    const provider = await prisma.service_providers.findUnique({
      where: { profile_id: user.id },
    });
    if (!provider) {
      return { items: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }
    where.provider_id = provider.id;
  }

  // Filters
  if (query.status) {
    const statuses = query.status.split(',').map((s) => s.trim().toUpperCase());
    where.status = { in: statuses };
  }

  if (query.priority) {
    where.priority = query.priority;
  }

  if (query.propertyId) {
    where.property_id = query.propertyId;
  }

  if (query.categoryId) {
    where.category_id = query.categoryId;
  }

  if (query.from || query.to) {
    where.created_at = {};
    if (query.from) where.created_at.gte = new Date(query.from);
    if (query.to) where.created_at.lte = new Date(query.to);
  }

  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  let orderBy = { created_at: 'desc' };
  if (query.sort === 'priority') {
    // Priority order in database is handled via array or created_at fallback
    orderBy = [{ priority: 'desc' }, { created_at: 'desc' }];
  }

  const [total, records] = await Promise.all([
    prisma.maintenance_requests.count({ where }),
    prisma.maintenance_requests.findMany({
      where,
      include: {
        properties: { select: { id: true, title: true, city: true } },
        service_categories: { select: { id: true, name: true } },
        spaces: { select: { id: true, name: true } },
        service_providers: { select: { id: true, business_name: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  const items = records.map((r) => ({
    id: r.id,
    propertyId: r.property_id,
    propertyTitle: r.properties?.title,
    city: r.properties?.city,
    spaceId: r.space_id,
    spaceName: r.spaces?.name ?? null,
    categoryId: r.category_id,
    categoryName: r.service_categories?.name ?? null,
    providerId: r.provider_id,
    providerBusinessName: r.service_providers?.business_name ?? null,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    scheduledAt: r.scheduled_at,
    estimatedCost: r.estimated_cost,
    actualCost: r.actual_cost,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  }));

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Retrieves detailed maintenance request by ID.
 * Exposes counterpart contact (NAME and PHONE) only when request is assigned.
 * NEVER exposes any email.
 * @param {string} id - Request UUID
 * @param {object} user - Authenticated user
 * @returns {Promise<object>}
 */
export async function getMaintenanceRequestById(id, user) {
  const req = await prisma.maintenance_requests.findUnique({
    where: { id },
    include: {
      properties: {
        select: {
          id: true,
          title: true,
          owner_id: true,
          address_line1: true,
          address_line2: true,
          city: true,
          state: true,
          postal_code: true,
          profiles: { select: { id: true, name: true, phone: true } },
        },
      },
      service_categories: { select: { id: true, name: true } },
      spaces: { select: { id: true, name: true } },
      service_providers: {
        include: {
          profiles: { select: { id: true, name: true, phone: true } },
        },
      },
      maintenance_updates: {
        include: { profiles: { select: { id: true, name: true } } },
        orderBy: { created_at: 'asc' },
      },
      provider_reviews: {
        select: { id: true, rating: true, comment: true, created_at: true },
      },
    },
  });

  if (!req) {
    throw AppError.notFound('Maintenance request not found');
  }

  const isOwner = req.properties.owner_id === user.id;
  const isProvider = req.service_providers?.profile_id === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isProvider && !isAdmin) {
    throw AppError.notFound('Maintenance request not found');
  }

  // Linked expense check (accessible only to property OWNER and ADMIN)
  let linkedExpenseId = null;
  if (isOwner || isAdmin) {
    const linkedExpense = await prisma.property_expenses.findFirst({
      where: { maintenance_request_id: id },
      select: { id: true },
    });
    linkedExpenseId = linkedExpense ? linkedExpense.id : null;
  }

  // Allowed actions calculation for this caller
  const allowedActions = [];
  if (isOwner || isAdmin) {
    if (req.status === 'OPEN') allowedActions.push('assign', 'cancel');
    if (req.status === 'ASSIGNED') allowedActions.push('unassign', 'cancel');
    if (req.status === 'IN_PROGRESS') allowedActions.push('complete', 'cancel');
    if (req.status === 'COMPLETED') {
      if (!req.provider_reviews) allowedActions.push('review');
      if (req.actual_cost && !linkedExpenseId) allowedActions.push('record_expense');
    }
  }
  if (isProvider) {
    if (req.status === 'ASSIGNED') allowedActions.push('start', 'decline');
    if (req.status === 'IN_PROGRESS') allowedActions.push('complete');
  }

  // Counterpart contact (Phone + Name only, NO EMAIL) when assigned
  let counterpartContact = null;
  const isAssignedJob = req.status !== 'OPEN' && req.provider_id;

  if (isAssignedJob) {
    if (isOwner || isAdmin) {
      if (req.service_providers) {
        counterpartContact = {
          role: 'PROVIDER',
          businessName: req.service_providers.business_name,
          contactName: req.service_providers.profiles?.name ?? 'Provider',
          phone: req.service_providers.profiles?.phone ?? null,
        };
      }
    } else if (isProvider) {
      counterpartContact = {
        role: 'OWNER',
        name: req.properties.profiles?.name ?? 'Property Owner',
        phone: req.properties.profiles?.phone ?? null,
      };
    }
  }

  // Generate signed URLs for update media
  const updatesWithSignedUrls = await Promise.all(
    req.maintenance_updates.map(async (u) => {
      let signedUrl = u.media_url;
      if (u.media_url) {
        try {
          signedUrl = await storageService.getSignedUrl('maintenance-media', u.media_url, 3600);
        } catch {
          // Keep storage path if signed URL generation fails
        }
      }
      return {
        id: u.id,
        note: u.note,
        mediaUrl: signedUrl,
        mediaType: u.media_type,
        addedBy: {
          id: u.profiles?.id,
          name: u.profiles?.name ?? 'User',
        },
        createdAt: u.created_at,
      };
    })
  );

  const result = {
    id: req.id,
    title: req.title,
    description: req.description,
    priority: req.priority,
    status: req.status,
    scheduledAt: req.scheduled_at,
    estimatedCost: req.estimated_cost,
    actualCost: req.actual_cost,
    completedAt: req.completed_at,
    createdAt: req.created_at,
    updatedAt: req.updated_at,
    property: {
      id: req.properties.id,
      title: req.properties.title,
      addressLine1: req.properties.address_line1,
      addressLine2: req.properties.address_line2,
      city: req.properties.city,
      state: req.properties.state,
      postalCode: req.properties.postal_code,
    },
    space: req.spaces ? { id: req.spaces.id, name: req.spaces.name } : null,
    category: req.service_categories ? { id: req.service_categories.id, name: req.service_categories.name } : null,
    provider: req.service_providers
      ? { id: req.service_providers.id, businessName: req.service_providers.business_name }
      : null,
    counterpartContact,
    updates: updatesWithSignedUrls,
    review: req.provider_reviews,
    allowedActions,
  };

  if (isOwner || isAdmin) {
    result.linkedExpenseId = linkedExpenseId;
  }

  return result;
}

/**
 * Updates an open or assigned maintenance request.
 * @param {string} id - Request UUID
 * @param {object} user - Authenticated user
 * @param {object} data - Fields to update
 * @returns {Promise<object>}
 */
export async function updateMaintenanceRequest(id, user, data) {
  const req = await prisma.maintenance_requests.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true } } },
  });

  if (!req) {
    throw AppError.notFound('Maintenance request not found');
  }

  if (user.role !== 'ADMIN' && req.properties.owner_id !== user.id) {
    throw AppError.notFound('Maintenance request not found');
  }

  if (req.status !== 'OPEN' && req.status !== 'ASSIGNED') {
    throw AppError.conflict('Only OPEN or ASSIGNED requests can be modified');
  }

  const updateFields = {};
  if (data.title !== undefined) updateFields.title = data.title;
  if (data.description !== undefined) updateFields.description = data.description;
  if (data.priority !== undefined) updateFields.priority = data.priority;
  if (data.categoryId !== undefined) updateFields.category_id = data.categoryId;
  if (data.estimatedCost !== undefined) {
    updateFields.estimated_cost = data.estimatedCost ? new Prisma.Decimal(data.estimatedCost) : null;
  }
  if (data.scheduledAt !== undefined) {
    updateFields.scheduled_at = data.scheduledAt ? new Date(data.scheduledAt) : null;
  }
  updateFields.updated_at = new Date();

  const updated = await prisma.maintenance_requests.update({
    where: { id },
    data: updateFields,
  });

  return formatMaintenanceResponse(updated);
}

/**
 * Assigns a verified available provider to an OPEN maintenance request.
 * Uses row locking FOR UPDATE.
 * @param {string} id - Request UUID
 * @param {object} user - Authenticated user
 * @param {{ providerId: string, scheduledAt?: string | null, estimatedCost?: string | number | null }} data
 * @returns {Promise<object>}
 */
export async function assignProvider(id, user, data) {
  const reqCheck = await prisma.maintenance_requests.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true, title: true } } },
  });

  if (!reqCheck) {
    throw AppError.notFound('Maintenance request not found');
  }

  if (user.role !== 'ADMIN' && reqCheck.properties.owner_id !== user.id) {
    throw AppError.notFound('Maintenance request not found');
  }

  // Provider validation
  const provider = await prisma.service_providers.findUnique({
    where: { id: data.providerId },
    include: { service_provider_categories: true },
  });

  if (!provider) {
    throw new AppError(400, 'PROVIDER_NOT_FOUND', 'Provider not found');
  }

  if (provider.verification_status !== 'VERIFIED') {
    throw new AppError(400, 'PROVIDER_NOT_VERIFIED', 'Only VERIFIED providers can be assigned to maintenance jobs');
  }

  if (!provider.is_available) {
    throw new AppError(400, 'PROVIDER_UNAVAILABLE', 'Selected provider is currently unavailable');
  }

  if (reqCheck.category_id) {
    const offersCategory = provider.service_provider_categories.some(
      (c) => c.category_id === reqCheck.category_id
    );
    if (!offersCategory) {
      throw new AppError(400, 'CATEGORY_MISMATCH', 'Selected provider does not service this category');
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    // 1. Lock row FOR UPDATE
    const rows = await tx.$queryRaw`
      SELECT id, status
      FROM public.maintenance_requests
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;
    const locked = rows[0];

    if (!locked) {
      throw AppError.notFound('Maintenance request not found');
    }

    if (locked.status !== 'OPEN') {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot assign request in ${locked.status} status`);
    }

    const updateFields = {
      status: 'ASSIGNED',
      provider_id: data.providerId,
      updated_at: new Date(),
    };

    if (data.scheduledAt !== undefined && data.scheduledAt !== null) {
      updateFields.scheduled_at = new Date(data.scheduledAt);
    }
    if (data.estimatedCost !== undefined && data.estimatedCost !== null) {
      updateFields.estimated_cost = new Prisma.Decimal(data.estimatedCost);
    }

    const res = await tx.maintenance_requests.update({
      where: { id },
      data: updateFields,
    });

    await tx.maintenance_updates.create({
      data: {
        maintenance_request_id: id,
        added_by: user.id,
        note: 'Status: OPEN -> ASSIGNED',
      },
    });

    return res;
  });

  // Notify assigned provider
  await createNotification({
    userId: provider.profile_id,
    type: 'MAINTENANCE_ASSIGNED',
    title: 'New Maintenance Job Assigned',
    message: `You have been assigned to maintenance job "${reqCheck.title}" at "${reqCheck.properties.title}".`,
    linkUrl: `/maintenance-requests/${id}`,
  });

  return formatMaintenanceResponse(updated);
}

/**
 * Unassigns a provider from an ASSIGNED request, returning it to OPEN.
 * @param {string} id - Request UUID
 * @param {object} user - Authenticated user
 * @returns {Promise<object>}
 */
export async function unassignProvider(id, user) {
  const reqCheck = await prisma.maintenance_requests.findUnique({
    where: { id },
    include: {
      properties: { select: { owner_id: true, title: true } },
      service_providers: { select: { profile_id: true } },
    },
  });

  if (!reqCheck) {
    throw AppError.notFound('Maintenance request not found');
  }

  if (user.role !== 'ADMIN' && reqCheck.properties.owner_id !== user.id) {
    throw AppError.notFound('Maintenance request not found');
  }

  const prevProviderProfileId = reqCheck.service_providers?.profile_id;

  const updated = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id, status
      FROM public.maintenance_requests
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;
    const locked = rows[0];

    if (!locked) {
      throw AppError.notFound('Maintenance request not found');
    }

    if (locked.status !== 'ASSIGNED') {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot unassign request in ${locked.status} status`);
    }

    const res = await tx.maintenance_requests.update({
      where: { id },
      data: {
        status: 'OPEN',
        provider_id: null,
        updated_at: new Date(),
      },
    });

    await tx.maintenance_updates.create({
      data: {
        maintenance_request_id: id,
        added_by: user.id,
        note: 'Status: ASSIGNED -> OPEN',
      },
    });

    return res;
  });

  if (prevProviderProfileId) {
    await createNotification({
      userId: prevProviderProfileId,
      type: 'MAINTENANCE_UNASSIGNED',
      title: 'Maintenance Job Unassigned',
      message: `You were unassigned from maintenance job "${reqCheck.title}".`,
      linkUrl: `/maintenance-requests/${id}`,
    });
  }

  return formatMaintenanceResponse(updated);
}

/**
 * Declines an ASSIGNED job by the assigned provider, moving it back to OPEN.
 * @param {string} id - Request UUID
 * @param {object} user - Authenticated provider
 * @param {{ reason: string }} data
 * @returns {Promise<object>}
 */
export async function declineJob(id, user, data) {
  const provider = await prisma.service_providers.findUnique({
    where: { profile_id: user.id },
  });

  const reqCheck = await prisma.maintenance_requests.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true, title: true } } },
  });

  if (!reqCheck) {
    throw AppError.notFound('Maintenance request not found');
  }

  if (!provider || reqCheck.provider_id !== provider.id) {
    throw AppError.notFound('Maintenance request not found');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id, status
      FROM public.maintenance_requests
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;
    const locked = rows[0];

    if (!locked) {
      throw AppError.notFound('Maintenance request not found');
    }

    if (locked.status !== 'ASSIGNED') {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot decline job in ${locked.status} status`);
    }

    const res = await tx.maintenance_requests.update({
      where: { id },
      data: {
        status: 'OPEN',
        provider_id: null,
        updated_at: new Date(),
      },
    });

    await tx.maintenance_updates.create({
      data: {
        maintenance_request_id: id,
        added_by: user.id,
        note: `Status: ASSIGNED -> OPEN (Declined by provider. Reason: ${data.reason})`,
      },
    });

    return res;
  });

  await createNotification({
    userId: reqCheck.properties.owner_id,
    type: 'MAINTENANCE_DECLINED',
    title: 'Provider Declined Job',
    message: `Provider declined job "${reqCheck.title}". Reason: ${data.reason}`,
    linkUrl: `/maintenance-requests/${id}`,
  });

  return formatMaintenanceResponse(updated);
}

/**
 * Starts an ASSIGNED job, transitioning status to IN_PROGRESS.
 * @param {string} id - Request UUID
 * @param {object} user - Authenticated provider or admin
 * @returns {Promise<object>}
 */
export async function startJob(id, user) {
  const provider = await prisma.service_providers.findUnique({
    where: { profile_id: user.id },
  });

  const reqCheck = await prisma.maintenance_requests.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true, title: true } } },
  });

  if (!reqCheck) {
    throw AppError.notFound('Maintenance request not found');
  }

  const isAssignedProvider = provider && reqCheck.provider_id === provider.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isAssignedProvider && !isAdmin) {
    throw AppError.notFound('Maintenance request not found');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id, status
      FROM public.maintenance_requests
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;
    const locked = rows[0];

    if (!locked) {
      throw AppError.notFound('Maintenance request not found');
    }

    if (locked.status !== 'ASSIGNED') {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot start job in ${locked.status} status`);
    }

    const res = await tx.maintenance_requests.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        updated_at: new Date(),
      },
    });

    await tx.maintenance_updates.create({
      data: {
        maintenance_request_id: id,
        added_by: user.id,
        note: 'Status: ASSIGNED -> IN_PROGRESS',
      },
    });

    return res;
  });

  await createNotification({
    userId: reqCheck.properties.owner_id,
    type: 'MAINTENANCE_STARTED',
    title: 'Maintenance Job Started',
    message: `Work on maintenance job "${reqCheck.title}" has begun.`,
    linkUrl: `/maintenance-requests/${id}`,
  });

  return formatMaintenanceResponse(updated);
}

/**
 * Completes an IN_PROGRESS job with final actualCost.
 * @param {string} id - Request UUID
 * @param {object} user - Authenticated user
 * @param {{ actualCost: string | number, note?: string }} data
 * @returns {Promise<object>}
 */
export async function completeJob(id, user, data) {
  const provider = await prisma.service_providers.findUnique({
    where: { profile_id: user.id },
  });

  const reqCheck = await prisma.maintenance_requests.findUnique({
    where: { id },
    include: {
      properties: { select: { owner_id: true, title: true } },
      service_providers: { select: { profile_id: true } },
    },
  });

  if (!reqCheck) {
    throw AppError.notFound('Maintenance request not found');
  }

  const isOwner = reqCheck.properties.owner_id === user.id;
  const isAssignedProvider = provider && reqCheck.provider_id === provider.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAssignedProvider && !isAdmin) {
    throw AppError.notFound('Maintenance request not found');
  }

  const actualCostDecimal = new Prisma.Decimal(data.actualCost).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP
  );

  const updated = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id, status
      FROM public.maintenance_requests
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;
    const locked = rows[0];

    if (!locked) {
      throw AppError.notFound('Maintenance request not found');
    }

    if (locked.status !== 'IN_PROGRESS') {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot complete job in ${locked.status} status`);
    }

    const noteText = data.note
      ? `Status: IN_PROGRESS -> COMPLETED: ${data.note}`
      : 'Status: IN_PROGRESS -> COMPLETED';

    const res = await tx.maintenance_requests.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actual_cost: actualCostDecimal,
        completed_at: new Date(),
        updated_at: new Date(),
      },
    });

    await tx.maintenance_updates.create({
      data: {
        maintenance_request_id: id,
        added_by: user.id,
        note: noteText,
      },
    });

    return res;
  });

  // Notify counterpart
  const recipientId = isOwner
    ? reqCheck.service_providers?.profile_id
    : reqCheck.properties.owner_id;

  if (recipientId) {
    await createNotification({
      userId: recipientId,
      type: 'MAINTENANCE_COMPLETED',
      title: 'Maintenance Job Completed',
      message: `Maintenance job "${reqCheck.title}" has been marked as completed. Actual Cost: ₹${actualCostDecimal.toFixed(2)}.`,
      linkUrl: `/maintenance-requests/${id}`,
    });
  }

  return formatMaintenanceResponse(updated);
}

/**
 * Cancels a maintenance request before completion.
 * @param {string} id - Request UUID
 * @param {object} user - Authenticated user
 * @param {{ reason: string }} data
 * @returns {Promise<object>}
 */
export async function cancelJob(id, user, data) {
  const reqCheck = await prisma.maintenance_requests.findUnique({
    where: { id },
    include: {
      properties: { select: { owner_id: true, title: true } },
      service_providers: { select: { profile_id: true } },
    },
  });

  if (!reqCheck) {
    throw AppError.notFound('Maintenance request not found');
  }

  const isOwner = reqCheck.properties.owner_id === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    throw AppError.notFound('Maintenance request not found');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id, status
      FROM public.maintenance_requests
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;
    const locked = rows[0];

    if (!locked) {
      throw AppError.notFound('Maintenance request not found');
    }

    if (locked.status === 'COMPLETED' || locked.status === 'CANCELLED') {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot cancel job in ${locked.status} status`);
    }

    const res = await tx.maintenance_requests.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        updated_at: new Date(),
      },
    });

    await tx.maintenance_updates.create({
      data: {
        maintenance_request_id: id,
        added_by: user.id,
        note: `Status: ${locked.status} -> CANCELLED. Reason: ${data.reason}`,
      },
    });

    return res;
  });

  if (reqCheck.service_providers?.profile_id) {
    await createNotification({
      userId: reqCheck.service_providers.profile_id,
      type: 'MAINTENANCE_CANCELLED',
      title: 'Maintenance Job Cancelled',
      message: `Maintenance job "${reqCheck.title}" was cancelled. Reason: ${data.reason}`,
      linkUrl: `/maintenance-requests/${id}`,
    });
  }

  return updated;
}

/**
 * Adds an update note and optional photo to a maintenance request.
 * Uploads photos to the private "maintenance-media" bucket.
 * @param {string} id - Request UUID
 * @param {object} user - Authenticated user
 * @param {string} note - Update note text
 * @param {Express.Multer.File} [file] - Optional photo file
 * @param {{ mimeType: string, ext: string }} [detectedFile] - Magic-byte validated format
 * @returns {Promise<object>}
 */
export async function addUpdateRequest(id, user, note, file, detectedFile) {
  const reqCheck = await prisma.maintenance_requests.findUnique({
    where: { id },
    include: {
      properties: { select: { owner_id: true, title: true } },
      service_providers: { select: { profile_id: true } },
    },
  });

  if (!reqCheck) {
    throw AppError.notFound('Maintenance request not found');
  }

  const provider = await prisma.service_providers.findUnique({
    where: { profile_id: user.id },
  });

  const isOwner = reqCheck.properties.owner_id === user.id;
  const isAssignedProvider = provider && reqCheck.provider_id === provider.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAssignedProvider && !isAdmin) {
    throw AppError.notFound('Maintenance request not found');
  }

  if (reqCheck.status === 'COMPLETED' || reqCheck.status === 'CANCELLED') {
    throw AppError.conflict('Cannot add updates to completed or cancelled requests');
  }

  let storagePath = null;

  if (file && detectedFile) {
    const mediaCount = await prisma.maintenance_updates.count({
      where: { maintenance_request_id: id, media_url: { not: null } },
    });

    if (mediaCount >= 20) {
      throw AppError.badRequest('Maximum 20 images allowed per maintenance request');
    }

    storagePath = `${reqCheck.property_id}/${reqCheck.id}/${crypto.randomUUID()}.${detectedFile.ext}`;

    await storageService.uploadPrivateFile(
      'maintenance-media',
      storagePath,
      file.buffer,
      detectedFile.mimeType
    );
  }

  let updateRow;
  try {
    updateRow = await prisma.$transaction(async (tx) => {
      const row = await tx.maintenance_updates.create({
        data: {
          maintenance_request_id: id,
          added_by: user.id,
          note,
          media_url: storagePath,
          media_type: storagePath ? 'IMAGE' : null,
        },
        include: {
          profiles: { select: { id: true, name: true } },
        },
      });

      if (storagePath) {
        await tx.media_assets.create({
          data: {
            owner_type: 'MAINTENANCE',
            owner_id: id,
            bucket: 'maintenance-media',
            storage_path: storagePath,
            mime_type: detectedFile.mimeType,
            size_bytes: file.size,
            uploaded_by: user.id,
            alt_text: note.slice(0, 255),
          },
        });
      }

      return row;
    });
  } catch (err) {
    if (storagePath) {
      await storageService.deleteFile('maintenance-media', storagePath);
    }
    throw err;
  }

  // Return signed URL for response
  let signedUrl = null;
  if (storagePath) {
    signedUrl = await storageService.getSignedUrl('maintenance-media', storagePath, 3600);
  }

  // Notify counterpart
  const counterpartId = isOwner
    ? reqCheck.service_providers?.profile_id
    : reqCheck.properties.owner_id;

  if (counterpartId) {
    await createNotification({
      userId: counterpartId,
      type: 'MAINTENANCE_UPDATE',
      title: 'New Maintenance Update',
      message: `A new update was posted on job "${reqCheck.title}".`,
      linkUrl: `/maintenance-requests/${id}`,
    });
  }

  return {
    id: updateRow.id,
    maintenanceRequestId: updateRow.maintenance_request_id,
    note: updateRow.note,
    mediaUrl: signedUrl,
    mediaType: updateRow.media_type,
    addedBy: updateRow.profiles,
    createdAt: updateRow.created_at,
  };
}

/**
 * Creates a review for a completed maintenance request.
 * Can only be submitted by the property owner. Exactly one review per request.
 * @param {string} requestId - Request UUID
 * @param {object} user - Authenticated user
 * @param {{ rating: number, comment?: string | null }} data
 * @returns {Promise<object>}
 */
export async function createProviderReview(requestId, user, data) {
  const req = await prisma.maintenance_requests.findUnique({
    where: { id: requestId },
    include: {
      properties: { select: { owner_id: true } },
      service_providers: { select: { id: true, profile_id: true } },
    },
  });

  if (!req) {
    throw AppError.notFound('Maintenance request not found');
  }

  if (req.properties.owner_id !== user.id) {
    throw AppError.notFound('Maintenance request not found');
  }

  if (req.status !== 'COMPLETED') {
    throw new AppError(409, 'JOB_NOT_COMPLETED', 'Only completed maintenance jobs can be reviewed');
  }

  if (!req.provider_id) {
    throw AppError.badRequest('No service provider was assigned to this maintenance request');
  }

  const existingReview = await prisma.provider_reviews.findUnique({
    where: { maintenance_request_id: requestId },
  });

  if (existingReview) {
    throw new AppError(409, 'ALREADY_REVIEWED', 'This maintenance job has already been reviewed');
  }

  try {
    const review = await prisma.provider_reviews.create({
      data: {
        maintenance_request_id: requestId,
        provider_id: req.provider_id,
        reviewer_id: user.id,
        rating: data.rating,
        comment: data.comment ?? null,
      },
      include: {
        profiles: { select: { id: true, name: true } },
      },
    });

    if (req.service_providers?.profile_id) {
      await createNotification({
        userId: req.service_providers.profile_id,
        type: 'PROVIDER_REVIEWED',
        title: 'New Review Received',
        message: `You received a ${data.rating}-star review for maintenance job "${req.title}".`,
        linkUrl: `/providers/me`,
      });
    }

    return {
      id: review.id,
      maintenanceRequestId: review.maintenance_request_id,
      providerId: review.provider_id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
      reviewerFirstName: review.profiles?.name ? review.profiles.name.split(' ')[0] : 'User',
    };
  } catch (err) {
    if (err.code === 'P2002') {
      throw new AppError(409, 'ALREADY_REVIEWED', 'This maintenance job has already been reviewed');
    }
    throw err;
  }
}
