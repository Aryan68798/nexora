import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../utils/AppError.js';
import { createNotification } from './notification.service.js';

/**
 * Creates a service provider profile for the authenticated user.
 * Verification status is ALWAYS initialized to PENDING.
 * @param {string} profileId - Authenticated user profile UUID
 * @param {{ businessName: string, bio?: string | null, serviceAreaCity: string, serviceAreaState: string, categoryIds: string[] }} data
 * @returns {Promise<object>}
 */
export async function createProviderProfile(profileId, data) {
  const existing = await prisma.service_providers.findUnique({
    where: { profile_id: profileId },
  });

  if (existing) {
    throw new AppError(409, 'PROFILE_EXISTS', 'Provider profile already exists for this user');
  }

  // Validate that all categories exist and are ACTIVE
  const activeCategories = await prisma.service_categories.findMany({
    where: {
      id: { in: data.categoryIds },
      is_active: true,
    },
    select: { id: true, name: true },
  });

  if (activeCategories.length !== data.categoryIds.length) {
    throw AppError.badRequest('One or more selected categories are invalid or inactive');
  }

  const provider = await prisma.$transaction(async (tx) => {
    const prov = await tx.service_providers.create({
      data: {
        profile_id: profileId,
        business_name: data.businessName,
        bio: data.bio ?? null,
        service_area_city: data.serviceAreaCity,
        service_area_state: data.serviceAreaState,
        verification_status: 'PENDING',
        is_available: true,
      },
    });

    await tx.service_provider_categories.createMany({
      data: data.categoryIds.map((catId) => ({
        provider_id: prov.id,
        category_id: catId,
      })),
    });

    return prov;
  });

  return {
    id: provider.id,
    profileId: provider.profile_id,
    businessName: provider.business_name,
    bio: provider.bio,
    serviceAreaCity: provider.service_area_city,
    serviceAreaState: provider.service_area_state,
    verificationStatus: provider.verification_status,
    isAvailable: provider.is_available,
    categories: activeCategories,
    createdAt: provider.created_at,
  };
}

/**
 * Retrieves the authenticated provider's own profile, categories, rating summary, and job counts.
 * Uses a single grouped query for job counts by status.
 * @param {string} profileId - User UUID
 * @returns {Promise<object>}
 */
export async function getMyProviderProfile(profileId) {
  const provider = await prisma.service_providers.findUnique({
    where: { profile_id: profileId },
    include: {
      service_provider_categories: {
        include: { service_categories: { select: { id: true, name: true } } },
      },
    },
  });

  if (!provider) {
    throw AppError.notFound('Provider profile not found');
  }

  // 1. Rating summary
  const reviewAgg = await prisma.provider_reviews.aggregate({
    where: { provider_id: provider.id },
    _avg: { rating: true },
    _count: { id: true },
  });

  const averageRating = reviewAgg._avg.rating !== null ? Number(reviewAgg._avg.rating.toFixed(1)) : null;
  const reviewCount = reviewAgg._count.id;

  // 2. Job counts by status (ONE grouped query)
  const jobStatusCounts = await prisma.maintenance_requests.groupBy({
    by: ['status'],
    where: { provider_id: provider.id },
    _count: { id: true },
  });

  const jobCounts = {
    OPEN: 0,
    ASSIGNED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  for (const item of jobStatusCounts) {
    jobCounts[item.status] = item._count.id;
  }

  return {
    id: provider.id,
    profileId: provider.profile_id,
    businessName: provider.business_name,
    bio: provider.bio,
    serviceAreaCity: provider.service_area_city,
    serviceAreaState: provider.service_area_state,
    verificationStatus: provider.verification_status,
    isAvailable: provider.is_available,
    categories: provider.service_provider_categories.map((c) => c.service_categories),
    ratingSummary: {
      averageRating,
      reviewCount,
    },
    jobCounts,
    createdAt: provider.created_at,
    updatedAt: provider.updated_at,
  };
}

/**
 * Updates the authenticated provider's profile.
 * Verification status cannot be changed here.
 * @param {string} profileId - User UUID
 * @param {{ businessName?: string, bio?: string | null, serviceAreaCity?: string, serviceAreaState?: string, isAvailable?: boolean, categoryIds?: string[] }} data
 * @returns {Promise<object>}
 */
export async function updateMyProviderProfile(profileId, data) {
  const provider = await prisma.service_providers.findUnique({
    where: { profile_id: profileId },
  });

  if (!provider) {
    throw AppError.notFound('Provider profile not found');
  }

  if (data.categoryIds) {
    const activeCategories = await prisma.service_categories.findMany({
      where: {
        id: { in: data.categoryIds },
        is_active: true,
      },
      select: { id: true },
    });
    if (activeCategories.length !== data.categoryIds.length) {
      throw AppError.badRequest('One or more selected categories are invalid or inactive');
    }
  }

  const updateFields = {};
  if (data.businessName !== undefined) updateFields.business_name = data.businessName;
  if (data.bio !== undefined) updateFields.bio = data.bio;
  if (data.serviceAreaCity !== undefined) updateFields.service_area_city = data.serviceAreaCity;
  if (data.serviceAreaState !== undefined) updateFields.service_area_state = data.serviceAreaState;
  if (data.isAvailable !== undefined) updateFields.is_available = data.isAvailable;
  updateFields.updated_at = new Date();

  await prisma.$transaction(async (tx) => {
    if (data.categoryIds) {
      await tx.service_provider_categories.deleteMany({
        where: { provider_id: provider.id },
      });
      await tx.service_provider_categories.createMany({
        data: data.categoryIds.map((catId) => ({
          provider_id: provider.id,
          category_id: catId,
        })),
      });
    }

    await tx.service_providers.update({
      where: { id: provider.id },
      data: updateFields,
    });
  });

  return getMyProviderProfile(profileId);
}

/**
 * Lists service providers.
 * Owners see only VERIFIED and isAvailable providers.
 * Ratings and job counts are calculated using ONE groupBy query each.
 * Never exposes phone or email.
 * @param {object} user - Authenticated user
 * @param {{ page?: number, limit?: number, categoryId?: string, city?: string, q?: string }} query
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export async function listProviders(user, query) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where = {};

  if (user.role === 'OWNER') {
    where.verification_status = 'VERIFIED';
    where.is_available = true;
  }

  if (query.city) {
    where.service_area_city = { contains: query.city, mode: 'insensitive' };
  }

  if (query.categoryId) {
    where.service_provider_categories = {
      some: { category_id: query.categoryId },
    };
  }

  if (query.q) {
    where.OR = [
      { business_name: { contains: query.q, mode: 'insensitive' } },
      { bio: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const [total, providers] = await Promise.all([
    prisma.service_providers.count({ where }),
    prisma.service_providers.findMany({
      where,
      include: {
        service_provider_categories: {
          include: { service_categories: { select: { id: true, name: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  if (providers.length === 0) {
    return {
      items: [],
      meta: { page, limit, total, totalPages: 0 },
    };
  }

  const providerIds = providers.map((p) => p.id);

  // ONE groupBy query for ratings across all matching providers
  const ratingsGroup = await prisma.provider_reviews.groupBy({
    by: ['provider_id'],
    where: { provider_id: { in: providerIds } },
    _avg: { rating: true },
    _count: { id: true },
  });

  const ratingMap = new Map();
  for (const r of ratingsGroup) {
    ratingMap.set(r.provider_id, {
      averageRating: r._avg.rating !== null ? Number(r._avg.rating.toFixed(1)) : null,
      reviewCount: r._count.id,
    });
  }

  // ONE groupBy query for completed job counts across all matching providers
  const jobsGroup = await prisma.maintenance_requests.groupBy({
    by: ['provider_id'],
    where: {
      provider_id: { in: providerIds },
      status: 'COMPLETED',
    },
    _count: { id: true },
  });

  const jobsMap = new Map();
  for (const j of jobsGroup) {
    jobsMap.set(j.provider_id, j._count.id);
  }

  const items = providers.map((p) => {
    const r = ratingMap.get(p.id) || { averageRating: null, reviewCount: 0 };
    const completedJobs = jobsMap.get(p.id) || 0;

    return {
      id: p.id,
      businessName: p.business_name,
      bio: p.bio,
      serviceAreaCity: p.service_area_city,
      serviceAreaState: p.service_area_state,
      isAvailable: p.is_available,
      verificationStatus: user.role === 'ADMIN' ? p.verification_status : undefined,
      categories: p.service_provider_categories.map((c) => c.service_categories),
      averageRating: r.averageRating,
      reviewCount: r.reviewCount,
      completedJobs,
    };
  });

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
 * Retrieves detailed provider profile with the last 10 reviews (reviewer first name only).
 * Never exposes phone or email.
 * @param {string} id - Provider UUID
 * @param {object} user - Authenticated user
 * @returns {Promise<object>}
 */
export async function getProviderById(id, user) {
  const provider = await prisma.service_providers.findUnique({
    where: { id },
    include: {
      service_provider_categories: {
        include: { service_categories: { select: { id: true, name: true } } },
      },
    },
  });

  if (!provider) {
    throw AppError.notFound('Provider not found');
  }

  const isSelf = provider.profile_id === user.id;
  const isAdmin = user.role === 'ADMIN';
  const isOwner = user.role === 'OWNER';

  if (!isSelf && !isAdmin && !isOwner) {
    throw AppError.notFound('Provider not found');
  }

  if (isOwner && (provider.verification_status !== 'VERIFIED' || !provider.is_available)) {
    throw AppError.notFound('Provider not found');
  }

  // Last 10 reviews with reviewer FIRST NAME only
  const reviews = await prisma.provider_reviews.findMany({
    where: { provider_id: id },
    orderBy: { created_at: 'desc' },
    take: 10,
    include: {
      profiles: { select: { name: true } },
    },
  });

  const reviewAgg = await prisma.provider_reviews.aggregate({
    where: { provider_id: id },
    _avg: { rating: true },
    _count: { id: true },
  });

  const completedJobsCount = await prisma.maintenance_requests.count({
    where: { provider_id: id, status: 'COMPLETED' },
  });

  return {
    id: provider.id,
    businessName: provider.business_name,
    bio: provider.bio,
    serviceAreaCity: provider.service_area_city,
    serviceAreaState: provider.service_area_state,
    isAvailable: provider.is_available,
    verificationStatus: isAdmin || isSelf ? provider.verification_status : undefined,
    categories: provider.service_provider_categories.map((c) => c.service_categories),
    averageRating: reviewAgg._avg.rating !== null ? Number(reviewAgg._avg.rating.toFixed(1)) : null,
    reviewCount: reviewAgg._count.id,
    completedJobs: completedJobsCount,
    recentReviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
      reviewerFirstName: r.profiles?.name ? r.profiles.name.split(' ')[0] : 'User',
    })),
  };
}

/**
 * Retrieves paginated reviews for a provider (reviewer first name only).
 * @param {string} providerId - Provider UUID
 * @param {{ page?: number, limit?: number }} query
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export async function getProviderReviews(providerId, query) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const [total, reviews] = await Promise.all([
    prisma.provider_reviews.count({ where: { provider_id: providerId } }),
    prisma.provider_reviews.findMany({
      where: { provider_id: providerId },
      include: { profiles: { select: { name: true } } },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    items: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
      reviewerFirstName: r.profiles?.name ? r.profiles.name.split(' ')[0] : 'User',
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Admin: lists providers with optional verificationStatus filter.
 * @param {{ page?: number, limit?: number, verificationStatus?: string }} query
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export async function adminListProviders(query) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where = {};
  if (query.verificationStatus) {
    where.verification_status = query.verificationStatus;
  }

  const [total, providers] = await Promise.all([
    prisma.service_providers.count({ where }),
    prisma.service_providers.findMany({
      where,
      include: {
        profiles: { select: { id: true, name: true, email: true } },
        service_provider_categories: {
          include: { service_categories: { select: { id: true, name: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    items: providers.map((p) => ({
      id: p.id,
      profileId: p.profile_id,
      profileName: p.profiles?.name,
      businessName: p.business_name,
      bio: p.bio,
      serviceAreaCity: p.service_area_city,
      serviceAreaState: p.service_area_state,
      verificationStatus: p.verification_status,
      isAvailable: p.is_available,
      categories: p.service_provider_categories.map((c) => c.service_categories),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Admin: updates provider verification status (VERIFIED | REJECTED | PENDING).
 * Logs action with pino and sends notification to provider.
 * @param {string} providerId - Provider UUID
 * @param {object} adminUser - Admin user profile
 * @param {{ status: 'VERIFIED' | 'REJECTED' | 'PENDING', note?: string }} data
 * @returns {Promise<object>}
 */
export async function adminUpdateVerification(providerId, adminUser, data) {
  const provider = await prisma.service_providers.findUnique({
    where: { id: providerId },
    include: { profiles: { select: { id: true, name: true } } },
  });

  if (!provider) {
    throw AppError.notFound('Provider not found');
  }

  const oldStatus = provider.verification_status;
  const newStatus = data.status;

  const updated = await prisma.service_providers.update({
    where: { id: providerId },
    data: {
      verification_status: newStatus,
      updated_at: new Date(),
    },
  });

  logger.info(
    {
      adminId: adminUser.id,
      providerId,
      oldStatus,
      newStatus,
      note: data.note || null,
    },
    'Provider verification status updated by admin'
  );

  await createNotification({
    userId: provider.profile_id,
    type: newStatus === 'VERIFIED' ? 'PROVIDER_VERIFIED' : 'PROVIDER_REJECTED',
    title: newStatus === 'VERIFIED' ? 'Provider Account Verified' : 'Provider Verification Update',
    message:
      newStatus === 'VERIFIED'
        ? 'Congratulations! Your service provider profile has been verified.'
        : `Your service provider profile status has been changed to ${newStatus}.${data.note ? ' Note: ' + data.note : ''}`,
    linkUrl: '/providers/me',
  });

  return {
    id: updated.id,
    businessName: updated.business_name,
    verificationStatus: updated.verification_status,
    updatedAt: updated.updated_at,
  };
}
