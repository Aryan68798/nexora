import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { storageService } from './storage.service.js';
import { createNotification } from './notification.service.js';
import {
  calculateInspectionScore,
  calculateGrade,
  calculateTrend,
} from './healthScore.service.js';

export const DEFAULT_INSPECTION_TEMPLATES = [
  { category: 'Structure', itemName: 'Foundation & Load-Bearing Walls' },
  { category: 'Structure', itemName: 'Roof, Ceiling & Structural Beams' },
  { category: 'Plumbing', itemName: 'Water Supply & Main Valve Pressure' },
  { category: 'Plumbing', itemName: 'Sinks, Toilets & Waste Drainage' },
  { category: 'Plumbing', itemName: 'Water Heater & Pipe Insulation' },
  { category: 'Electrical', itemName: 'Distribution Board & Circuit Breakers' },
  { category: 'Electrical', itemName: 'Power Outlets & Earthing Grounding' },
  { category: 'Electrical', itemName: 'Lighting Fixtures & Switches' },
  { category: 'Safety', itemName: 'Smoke Detectors & Fire Alarms' },
  { category: 'Safety', itemName: 'Fire Extinguishers & First Aid Station' },
  { category: 'Safety', itemName: 'Emergency Egress & Exit Signage' },
  { category: 'Safety', itemName: 'Door Locks, Window Latches & Security' },
  { category: 'HVAC', itemName: 'Air Conditioning Units & Thermostat' },
  { category: 'HVAC', itemName: 'Ventilation Ducting & Exhaust Fans' },
  { category: 'HVAC', itemName: 'Air Filters & Heating Elements' },
  { category: 'Interiors', itemName: 'Internal Doors, Frames & Hardware' },
  { category: 'Interiors', itemName: 'Flooring, Tiles & Grouting' },
  { category: 'Interiors', itemName: 'Wall Paint, Plaster & Moisture Signs' },
  { category: 'Exterior', itemName: 'Building Facade, Cladding & Exterior Paint' },
  { category: 'Exterior', itemName: 'Balconies, Railings & Parapets' },
  { category: 'Cleanliness', itemName: 'Pest Control & General Sanitation' },
];

/**
 * Creates a new scheduled inspection for a property.
 * @param {string} propertyId - Property UUID
 * @param {object} user - Authenticated user
 * @param {{ scheduledAt: string, inspectorId?: string, summary?: string }} input - Inspection details
 * @returns {Promise<object>} Created inspection
 */
export async function createInspection(propertyId, user, input) {
  const property = await prisma.properties.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw AppError.notFound('Property not found');
  }

  if (user.role !== 'ADMIN' && property.owner_id !== user.id) {
    throw AppError.notFound('Property not found');
  }

  const inspectorId = input.inspectorId || user.id;

  if (inspectorId !== user.id) {
    const inspectorProfile = await prisma.profiles.findUnique({
      where: { id: inspectorId },
    });
    if (!inspectorProfile || !['OWNER', 'PROVIDER', 'ADMIN'].includes(inspectorProfile.role)) {
      throw AppError.badRequest('Inspector must be a registered user with role OWNER or PROVIDER');
    }
  }

  const inspection = await prisma.inspections.create({
    data: {
      property_id: propertyId,
      inspector_id: inspectorId,
      scheduled_at: new Date(input.scheduledAt),
      summary: input.summary || null,
      status: 'SCHEDULED',
    },
    include: {
      profiles: {
        select: { id: true, name: true, role: true, email: true },
      },
    },
  });

  if (inspectorId !== user.id) {
    await createNotification({
      userId: inspectorId,
      type: 'INSPECTION_ASSIGNED',
      title: 'New Inspection Assigned',
      message: `You have been assigned to inspect property "${property.title}".`,
      linkUrl: `/inspections/${inspection.id}`,
    });
  }

  return {
    id: inspection.id,
    propertyId: inspection.property_id,
    inspectorId: inspection.inspector_id,
    inspector: inspection.profiles,
    scheduledAt: inspection.scheduled_at,
    status: inspection.status,
    summary: inspection.summary,
    createdAt: inspection.created_at,
  };
}

/**
 * Lists inspections for a given property with pagination and optional filters.
 * @param {string} propertyId - Property UUID
 * @param {object} user - Authenticated user
 * @param {{ page?: number, limit?: number, status?: string, from?: string, to?: string }} query - Filter options
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export async function listPropertyInspections(propertyId, user, query) {
  const property = await prisma.properties.findUnique({
    where: { id: propertyId },
  });

  if (!property || (user.role !== 'ADMIN' && property.owner_id !== user.id)) {
    throw AppError.notFound('Property not found');
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where = { property_id: propertyId };
  if (query.status) {
    where.status = query.status;
  }
  if (query.from || query.to) {
    where.scheduled_at = {};
    if (query.from) where.scheduled_at.gte = new Date(query.from);
    if (query.to) where.scheduled_at.lte = new Date(query.to);
  }

  const [total, records] = await Promise.all([
    prisma.inspections.count({ where }),
    prisma.inspections.findMany({
      where,
      include: {
        profiles: { select: { name: true } },
      },
      orderBy: { scheduled_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const items = records.map((item) => ({
    id: item.id,
    propertyId: item.property_id,
    status: item.status,
    scheduledAt: item.scheduled_at,
    inspectedAt: item.inspected_at,
    score: item.overall_condition_score,
    grade: item.overall_condition_score ? calculateGrade(item.overall_condition_score) : null,
    summary: item.summary,
    inspectorName: item.profiles?.name || 'Unknown',
    createdAt: item.created_at,
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
 * Retrieves single inspection detail with items grouped by category, media with signed URLs, and score breakdown.
 * @param {string} id - Inspection UUID
 * @param {object} user - Authenticated user
 * @returns {Promise<object>}
 */
export async function getInspectionById(id, user) {
  const inspection = await prisma.inspections.findUnique({
    where: { id },
    include: {
      properties: {
        select: { id: true, title: true, owner_id: true },
      },
      profiles: {
        select: { id: true, name: true, role: true },
      },
      inspection_items: {
        orderBy: [{ category: 'asc' }, { item_name: 'asc' }],
      },
      inspection_media: {
        orderBy: { created_at: 'desc' },
      },
    },
  });

  if (!inspection) {
    throw AppError.notFound('Inspection not found');
  }

  const isOwner = inspection.properties?.owner_id === user.id;
  const isInspector = inspection.inspector_id === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isInspector && !isAdmin) {
    throw AppError.notFound('Inspection not found');
  }

  // Convert storage path in url to signed URL (3600 seconds)
  const mediaWithSignedUrls = await Promise.all(
    inspection.inspection_media.map(async (m) => {
      let signedUrl = m.url;
      try {
        signedUrl = await storageService.getSignedUrl('inspection-media', m.url, 3600);
      } catch {
        // Keep storage path if signed URL generation fails
      }
      return {
        id: m.id,
        url: signedUrl,
        mediaType: m.media_type,
        caption: m.caption,
        createdAt: m.created_at,
      };
    })
  );

  // Group items by category
  const itemsByCategory = {};
  for (const item of inspection.inspection_items) {
    if (!itemsByCategory[item.category]) {
      itemsByCategory[item.category] = [];
    }
    itemsByCategory[item.category].push({
      id: item.id,
      itemName: item.item_name,
      category: item.category,
      condition: item.condition,
      notes: item.notes,
      checkedAt: item.checked_at,
    });
  }

  const scoreBreakdown = calculateInspectionScore(inspection.inspection_items);

  return {
    id: inspection.id,
    propertyId: inspection.property_id,
    property: {
      id: inspection.properties?.id,
      title: inspection.properties?.title,
    },
    inspectorId: inspection.inspector_id,
    inspector: inspection.profiles,
    status: inspection.status,
    scheduledAt: inspection.scheduled_at,
    inspectedAt: inspection.inspected_at,
    overallConditionScore: inspection.overall_condition_score,
    grade: inspection.overall_condition_score ? calculateGrade(inspection.overall_condition_score) : null,
    summary: inspection.summary,
    reportUrl: inspection.report_url,
    createdAt: inspection.created_at,
    updatedAt: inspection.updated_at,
    itemsByCategory,
    items: inspection.inspection_items.map((i) => ({
      id: i.id,
      itemName: i.item_name,
      category: i.category,
      condition: i.condition,
      notes: i.notes,
      checkedAt: i.checked_at,
    })),
    media: mediaWithSignedUrls,
    score: scoreBreakdown,
  };
}

/**
 * Updates inspection schedule or summary while in SCHEDULED status.
 * @param {string} id - Inspection UUID
 * @param {object} user - Authenticated user
 * @param {{ scheduledAt?: string, summary?: string }} input - Fields to update
 * @returns {Promise<object>}
 */
export async function updateInspection(id, user, input) {
  const inspection = await prisma.inspections.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true } } },
  });

  if (!inspection) {
    throw AppError.notFound('Inspection not found');
  }

  const isOwner = inspection.properties?.owner_id === user.id;
  const isInspector = inspection.inspector_id === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isInspector && !isAdmin) {
    throw AppError.notFound('Inspection not found');
  }

  if (inspection.status === 'COMPLETED' || inspection.status === 'CANCELLED') {
    throw AppError.conflict('Cannot modify completed or cancelled inspection');
  }

  if (isInspector && !isOwner && !isAdmin) {
    if (input.scheduledAt !== undefined) {
      throw AppError.badRequest('Assigned inspector cannot modify scheduled date');
    }
  }

  const updateData = {};
  if (input.summary !== undefined) {
    updateData.summary = input.summary;
  }
  if (input.scheduledAt !== undefined && (isOwner || isAdmin)) {
    updateData.scheduled_at = new Date(input.scheduledAt);
  }
  updateData.updated_at = new Date();

  const updated = await prisma.inspections.update({
    where: { id },
    data: updateData,
  });

  return {
    id: updated.id,
    propertyId: updated.property_id,
    inspectorId: updated.inspector_id,
    scheduledAt: updated.scheduled_at,
    status: updated.status,
    summary: updated.summary,
    updatedAt: updated.updated_at,
  };
}

/**
 * Replaces the entire inspection checklist in one transaction.
 * Moves SCHEDULED inspections to IN_PROGRESS.
 * @param {string} id - Inspection UUID
 * @param {object} user - Authenticated user
 * @param {Array<{ itemName: string, category: string, condition: string, notes?: string }>} items - New items checklist
 * @returns {Promise<object>}
 */
export async function updateInspectionItems(id, user, items) {
  const inspection = await prisma.inspections.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true } } },
  });

  if (!inspection) {
    throw AppError.notFound('Inspection not found');
  }

  const isOwner = inspection.properties?.owner_id === user.id;
  const isInspector = inspection.inspector_id === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isInspector && !isAdmin) {
    throw AppError.notFound('Inspection not found');
  }

  if (inspection.status === 'COMPLETED' || inspection.status === 'CANCELLED') {
    throw AppError.conflict('Cannot modify items of completed or cancelled inspection');
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Delete all existing items
    await tx.inspection_items.deleteMany({
      where: { inspection_id: id },
    });

    // 2. Insert new checklist items
    await tx.inspection_items.createMany({
      data: items.map((it) => ({
        inspection_id: id,
        item_name: it.itemName,
        category: it.category,
        condition: it.condition,
        notes: it.notes || null,
        checked_at: now,
      })),
    });

    // 3. Move SCHEDULED to IN_PROGRESS
    if (inspection.status === 'SCHEDULED') {
      await tx.inspections.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          updated_at: now,
        },
      });
    }
  });

  const updatedItems = await prisma.inspection_items.findMany({
    where: { inspection_id: id },
    orderBy: [{ category: 'asc' }, { item_name: 'asc' }],
  });

  return {
    inspectionId: id,
    status: inspection.status === 'SCHEDULED' ? 'IN_PROGRESS' : inspection.status,
    itemCount: updatedItems.length,
    items: updatedItems.map((i) => ({
      id: i.id,
      itemName: i.item_name,
      category: i.category,
      condition: i.condition,
      notes: i.notes,
      checkedAt: i.checked_at,
    })),
  };
}

/**
 * Completes an inspection in ONE transaction with row locking FOR UPDATE.
 * Deterministically calculates health condition score on the server.
 * @param {string} id - Inspection UUID
 * @param {object} user - Authenticated user
 * @returns {Promise<object>} Completed inspection and score result
 */
export async function completeInspection(id, user) {
  const inspectionCheck = await prisma.inspections.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true, title: true } } },
  });

  if (!inspectionCheck) {
    throw AppError.notFound('Inspection not found');
  }

  const isOwner = inspectionCheck.properties?.owner_id === user.id;
  const isInspector = inspectionCheck.inspector_id === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isInspector && !isAdmin) {
    throw AppError.notFound('Inspection not found');
  }

  if (inspectionCheck.status === 'COMPLETED') {
    throw AppError.conflict('Inspection is already completed');
  }
  if (inspectionCheck.status === 'CANCELLED') {
    throw AppError.conflict('Cannot complete cancelled inspection');
  }

  const { updated, scoreResult } = await prisma.$transaction(async (tx) => {
    // 1. Lock inspection row FOR UPDATE
    const rows = await tx.$queryRaw`
      SELECT id, property_id, inspector_id, status
      FROM public.inspections
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;
    const locked = rows[0];
    if (!locked) {
      throw AppError.notFound('Inspection not found');
    }
    if (locked.status === 'COMPLETED') {
      throw AppError.conflict('Inspection is already completed');
    }
    if (locked.status === 'CANCELLED') {
      throw AppError.conflict('Cannot complete cancelled inspection');
    }

    // 2. Fetch inspection items
    const items = await tx.inspection_items.findMany({
      where: { inspection_id: id },
    });

    if (items.length === 0) {
      throw new AppError(409, 'NO_ITEMS', 'Cannot complete inspection without evaluated items');
    }

    // 3. Compute deterministic score
    const computedScore = calculateInspectionScore(items);
    const now = new Date();

    // 4. Update inspection status and score
    const updatedRecord = await tx.inspections.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        inspected_at: now,
        overall_condition_score: computedScore.overallScore,
        updated_at: now,
      },
      include: {
        properties: { select: { id: true, title: true, owner_id: true } },
      },
    });

    return { updated: updatedRecord, scoreResult: computedScore };
  });

  // Notify owner if completed by an external inspector
  if (updated.properties?.owner_id !== user.id) {
    await createNotification({
      userId: updated.properties.owner_id,
      type: 'INSPECTION_COMPLETED',
      title: 'Inspection Completed',
      message: `Inspection for property "${updated.properties.title}" has been completed with score ${scoreResult.overallScore} (${scoreResult.grade}).`,
      linkUrl: `/inspections/${id}`,
    });
  }

  return {
    id: updated.id,
    propertyId: updated.property_id,
    inspectorId: updated.inspector_id,
    status: updated.status,
    inspectedAt: updated.inspected_at,
    overallConditionScore: updated.overall_condition_score,
    grade: scoreResult.grade,
    score: scoreResult,
  };
}

/**
 * Cancels an inspection before completion.
 * Only owner or admin may cancel.
 * @param {string} id - Inspection UUID
 * @param {object} user - Authenticated user
 * @returns {Promise<object>} Cancelled inspection
 */
export async function cancelInspection(id, user) {
  const inspection = await prisma.inspections.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true, title: true } } },
  });

  if (!inspection) {
    throw AppError.notFound('Inspection not found');
  }

  const isOwner = inspection.properties?.owner_id === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    if (inspection.inspector_id === user.id) {
      throw AppError.forbidden('Only property owner or administrator can cancel an inspection');
    }
    throw AppError.notFound('Inspection not found');
  }

  if (inspection.status === 'COMPLETED') {
    throw AppError.conflict('Completed inspections cannot be cancelled');
  }

  if (inspection.status === 'CANCELLED') {
    return {
      id: inspection.id,
      status: 'CANCELLED',
      message: 'Inspection is already cancelled',
    };
  }

  const updated = await prisma.inspections.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      updated_at: new Date(),
    },
  });

  if (inspection.inspector_id !== user.id) {
    await createNotification({
      userId: inspection.inspector_id,
      type: 'INSPECTION_CANCELLED',
      title: 'Inspection Cancelled',
      message: `Inspection for property "${inspection.properties?.title}" scheduled for ${inspection.scheduled_at.toISOString()} has been cancelled.`,
      linkUrl: `/inspections/${id}`,
    });
  }

  return {
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updated_at,
  };
}

/**
 * Uploads an image to the private "inspection-media" bucket.
 * Records media_assets and inspection_media, and returns a signed temporary URL.
 * @param {string} id - Inspection UUID
 * @param {object} user - Authenticated user
 * @param {Express.Multer.File} file - Uploaded file
 * @param {{ mimeType: string, ext: string }} detectedFile - Magic-byte validated format
 * @param {string} [caption] - Optional media caption
 * @returns {Promise<object>}
 */
export async function uploadInspectionMedia(id, user, file, detectedFile, caption) {
  const inspection = await prisma.inspections.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true } } },
  });

  if (!inspection) {
    throw AppError.notFound('Inspection not found');
  }

  const isOwner = inspection.properties?.owner_id === user.id;
  const isInspector = inspection.inspector_id === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isInspector && !isAdmin) {
    throw AppError.notFound('Inspection not found');
  }

  if (inspection.status === 'COMPLETED' || inspection.status === 'CANCELLED') {
    throw AppError.conflict('Cannot upload media for completed or cancelled inspection');
  }

  const mediaCount = await prisma.inspection_media.count({
    where: { inspection_id: id },
  });

  if (mediaCount >= 20) {
    throw AppError.badRequest('Maximum 20 media items allowed per inspection');
  }

  const storagePath = `${inspection.property_id}/${inspection.id}/${crypto.randomUUID()}.${detectedFile.ext}`;

  // 1. Upload to private Supabase Storage bucket
  await storageService.uploadPrivateFile(
    'inspection-media',
    storagePath,
    file.buffer,
    detectedFile.mimeType
  );

  // 2. Insert records into DB in a transaction
  let mediaRecord;
  try {
    const [insMedia] = await prisma.$transaction([
      prisma.inspection_media.create({
        data: {
          inspection_id: id,
          url: storagePath,
          media_type: detectedFile.mimeType,
          caption: caption || null,
        },
      }),
      prisma.media_assets.create({
        data: {
          owner_type: 'INSPECTION',
          owner_id: id,
          bucket: 'inspection-media',
          storage_path: storagePath,
          mime_type: detectedFile.mimeType,
          size_bytes: file.size,
          uploaded_by: user.id,
          alt_text: caption || null,
        },
      }),
    ]);
    mediaRecord = insMedia;
  } catch (err) {
    // Clean up uploaded file if DB transaction fails
    await storageService.deleteFile('inspection-media', storagePath);
    throw err;
  }

  // 3. Return temporary signed URL
  const signedUrl = await storageService.getSignedUrl('inspection-media', storagePath, 3600);

  return {
    id: mediaRecord.id,
    inspectionId: mediaRecord.inspection_id,
    url: signedUrl,
    storagePath,
    mediaType: mediaRecord.media_type,
    caption: mediaRecord.caption,
    createdAt: mediaRecord.created_at,
  };
}

/**
 * Deletes inspection media object from private storage and database records.
 * @param {string} id - Inspection media UUID
 * @param {object} user - Authenticated user
 * @returns {Promise<void>}
 */
export async function deleteInspectionMedia(id, user) {
  const media = await prisma.inspection_media.findUnique({
    where: { id },
    include: {
      inspections: {
        include: {
          properties: { select: { owner_id: true } },
        },
      },
    },
  });

  if (!media) {
    throw AppError.notFound('Media asset not found');
  }

  const inspection = media.inspections;
  const isOwner = inspection?.properties?.owner_id === user.id;
  const isInspector = inspection?.inspector_id === user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isInspector && !isAdmin) {
    throw AppError.notFound('Media asset not found');
  }

  if (inspection.status === 'COMPLETED' || inspection.status === 'CANCELLED') {
    throw AppError.conflict('Cannot delete media for completed or cancelled inspection');
  }

  // 1. Delete from Supabase Storage
  await storageService.deleteFile('inspection-media', media.url);

  // 2. Delete database records in transaction
  await prisma.$transaction([
    prisma.inspection_media.delete({ where: { id } }),
    prisma.media_assets.deleteMany({
      where: {
        owner_type: 'INSPECTION',
        owner_id: media.inspection_id,
        storage_path: media.url,
      },
    }),
  ]);
}

/**
 * Retrieves property health score, trends, breakdown, and historical data.
 * @param {string} propertyId - Property UUID
 * @param {object} user - Authenticated user
 * @returns {Promise<object>}
 */
export async function getPropertyHealth(propertyId, user) {
  const property = await prisma.properties.findUnique({
    where: { id: propertyId },
  });

  if (!property || (user.role !== 'ADMIN' && property.owner_id !== user.id)) {
    throw AppError.notFound('Property not found');
  }

  const completed = await prisma.inspections.findMany({
    where: {
      property_id: propertyId,
      status: 'COMPLETED',
    },
    include: {
      inspection_items: true,
    },
    orderBy: { inspected_at: 'desc' },
    take: 6,
  });

  if (completed.length === 0) {
    return { hasData: false };
  }

  const latest = completed[0];
  const scoreBreakdown = calculateInspectionScore(latest.inspection_items);

  const previousScore = completed.length > 1 ? completed[1].overall_condition_score : null;
  const trend = calculateTrend(latest.overall_condition_score, previousScore);

  const nextScheduled = await prisma.inspections.findFirst({
    where: {
      property_id: propertyId,
      status: 'SCHEDULED',
      scheduled_at: { gte: new Date() },
    },
    orderBy: { scheduled_at: 'asc' },
  });

  const history = completed
    .map((ins) => ({
      id: ins.id,
      score: ins.overall_condition_score,
      grade: calculateGrade(ins.overall_condition_score),
      inspectedAt: ins.inspected_at,
    }))
    .reverse();

  return {
    hasData: true,
    score: latest.overall_condition_score,
    grade: calculateGrade(latest.overall_condition_score),
    categoryBreakdown: scoreBreakdown.categories,
    worstItems: scoreBreakdown.worstItems,
    inspectedAt: latest.inspected_at,
    previousScore,
    trend,
    nextScheduledDate: nextScheduled?.scheduled_at || null,
    history,
  };
}

/**
 * Retrieves health overview for all properties owned by a user using ONE single query.
 * @param {string} ownerId - Owner UUID
 * @returns {Promise<object[]>}
 */
export async function getOwnerHealthOverview(ownerId) {
  const rows = await prisma.$queryRaw`
    WITH ranked_inspections AS (
      SELECT
        property_id,
        overall_condition_score,
        inspected_at,
        ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY inspected_at DESC) as rn
      FROM public.inspections
      WHERE status = 'COMPLETED'
    )
    SELECT
      p.id,
      p.title,
      r1.overall_condition_score AS latest_score,
      r1.inspected_at AS last_inspected_at,
      r2.overall_condition_score AS previous_score
    FROM public.properties p
    LEFT JOIN ranked_inspections r1 ON p.id = r1.property_id AND r1.rn = 1
    LEFT JOIN ranked_inspections r2 ON p.id = r2.property_id AND r2.rn = 2
    WHERE p.owner_id = ${ownerId}::uuid
    ORDER BY p.created_at DESC
  `;

  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  return rows.map((r) => {
    const lastInspectedAt = r.last_inspected_at ? new Date(r.last_inspected_at) : null;
    const overdue = !lastInspectedAt || now - lastInspectedAt.getTime() > ninetyDaysMs;

    return {
      id: r.id,
      title: r.title,
      latestScore: r.latest_score ?? null,
      grade: r.latest_score ? calculateGrade(r.latest_score) : null,
      trend: calculateTrend(r.latest_score, r.previous_score),
      lastInspectedDate: lastInspectedAt,
      overdue,
    };
  });
}
