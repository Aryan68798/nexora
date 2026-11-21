import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { SPACE_TYPES } from '../validators/space.validator.js';

export async function searchSpaces(req, res) {
  const query = req.query;
  const { page, pageSize, skip, take } = getPagination(query);

  const where = {
    status: 'AVAILABLE',
    properties: {
      status: 'ACTIVE',
    },
  };

  if (query.city) {
    where.properties = {
      ...where.properties,
      city: { equals: query.city, mode: 'insensitive' },
    };
  }

  if (query.state) {
    where.properties = {
      ...where.properties,
      state: { equals: query.state, mode: 'insensitive' },
    };
  }

  if (query.spaceType) {
    where.space_type = { in: query.spaceType };
  }

  if (query.priceUnit) {
    where.price_unit = query.priceUnit;
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.price_amount = {};
    if (query.minPrice !== undefined) {
      where.price_amount.gte = new Prisma.Decimal(query.minPrice);
    }
    if (query.maxPrice !== undefined) {
      where.price_amount.lte = new Prisma.Decimal(query.maxPrice);
    }
  }

  if (query.minCapacity !== undefined) {
    where.capacity = { gte: query.minCapacity };
  }

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
      { properties: { title: { contains: query.q, mode: 'insensitive' } } },
      { properties: { city: { contains: query.q, mode: 'insensitive' } } },
    ];
  }

  // Determine database sort order
  let orderBy = { created_at: 'desc' };
  if (query.sort === 'price_asc') {
    orderBy = { price_amount: 'asc' };
  } else if (query.sort === 'price_desc') {
    orderBy = { price_amount: 'desc' };
  } else if (query.sort === 'newest') {
    orderBy = { created_at: 'desc' };
  }

  const [total, spaces] = await Promise.all([
    prisma.spaces.count({ where }),
    prisma.spaces.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        properties: {
          select: {
            id: true,
            title: true,
            city: true,
            state: true,
            image_url: true,
          },
        },
        space_media: {
          where: { is_cover: true },
          select: { url: true },
          take: 1,
        },
      },
    }),
  ]);

  const spaceIds = spaces.map((s) => s.id);

  // 1. One groupBy for ratings across the page
  const ratingsGroup =
    spaceIds.length > 0
      ? await prisma.space_reviews.groupBy({
          by: ['space_id'],
          where: { space_id: { in: spaceIds } },
          _avg: { rating: true },
          _count: { rating: true },
        })
      : [];

  const ratingMap = new Map();
  for (const r of ratingsGroup) {
    ratingMap.set(r.space_id, {
      average: r._avg.rating !== null ? Number(r._avg.rating.toFixed(1)) : null,
      count: r._count.rating,
    });
  }

  // 2. One query for favorites if caller is logged in
  let favoriteSet = new Set();
  if (req.user && spaceIds.length > 0) {
    const favs = await prisma.favorites.findMany({
      where: {
        customer_id: req.user.id,
        space_id: { in: spaceIds },
      },
      select: { space_id: true },
    });
    favoriteSet = new Set(favs.map((f) => f.space_id));
  }

  let items = spaces.map((s) => {
    const stats = ratingMap.get(s.id) || { average: null, count: 0 };
    const item = {
      id: s.id,
      name: s.name,
      spaceType: s.space_type,
      capacity: s.capacity,
      priceAmount: s.price_amount,
      priceUnit: s.price_unit,
      property: s.properties,
      coverImageUrl: s.space_media[0]?.url || s.properties?.image_url || null,
      averageRating: stats.average,
      reviewCount: stats.count,
    };

    if (req.user) {
      item.isFavorite = favoriteSet.has(s.id);
    }

    return item;
  });

  // If sorting by rating, sort the page results by averageRating descending
  if (query.sort === 'rating') {
    items.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
  }

  sendSuccess(res, items, 200, buildPaginationMeta(page, pageSize, total));
}

export async function getSpaceById(req, res) {
  const { id } = req.params;
  const currentUser = req.user;

  const space = await prisma.spaces.findUnique({
    where: { id },
    include: {
      properties: {
        select: {
          id: true,
          title: true,
          city: true,
          state: true,
          status: true,
          owner_id: true,
          profiles: {
            select: { id: true, name: true }, // NEVER expose email/phone
          },
        },
      },
      space_media: {
        orderBy: { sort_order: 'asc' },
      },
    },
  });

  if (!space) {
    throw AppError.notFound('Space not found');
  }

  const isOwnerOrAdmin =
    currentUser &&
    (space.properties.owner_id === currentUser.id || currentUser.role === 'ADMIN');

  // Visibility check: If space is not AVAILABLE or property is not ACTIVE, only owner/admin can see it
  if ((space.status !== 'AVAILABLE' || space.properties.status !== 'ACTIVE') && !isOwnerOrAdmin) {
    throw AppError.notFound('Space not found');
  }

  const [ratingAgg, favCount] = await Promise.all([
    prisma.space_reviews.aggregate({
      where: { space_id: id },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    currentUser
      ? prisma.favorites.count({
          where: { customer_id: currentUser.id, space_id: id },
        })
      : Promise.resolve(0),
  ]);

  const { properties, space_media, ...spaceData } = space;

  const result = {
    ...spaceData,
    spaceType: spaceData.space_type,
    priceAmount: spaceData.price_amount,
    priceUnit: spaceData.price_unit,
    property: {
      id: properties.id,
      title: properties.title,
      city: properties.city,
      state: properties.state,
      owner: properties.profiles,
    },
    media: space_media,
    averageRating: ratingAgg._avg.rating !== null ? Number(ratingAgg._avg.rating.toFixed(1)) : null,
    reviewCount: ratingAgg._count.rating,
  };

  if (currentUser) {
    result.isFavorite = favCount > 0;
  }

  sendSuccess(res, result);
}

export async function getSpaceReviews(req, res) {
  const { id } = req.params;
  const { page, pageSize, skip, take } = getPagination(req.query);

  const [total, reviews] = await Promise.all([
    prisma.space_reviews.count({ where: { space_id: id } }),
    prisma.space_reviews.findMany({
      where: { space_id: id },
      skip,
      take,
      orderBy: { created_at: 'desc' },
      include: {
        profiles: {
          select: { name: true },
        },
      },
    }),
  ]);

  const items = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
    customer: {
      firstName: r.profiles?.name ? r.profiles.name.trim().split(' ')[0] : 'Guest',
    },
  }));

  sendSuccess(res, items, 200, buildPaginationMeta(page, pageSize, total));
}

export async function getCatalogFilters(_req, res) {
  const [citiesData, priceAgg] = await Promise.all([
    prisma.properties.findMany({
      where: {
        status: 'ACTIVE',
        spaces: {
          some: { status: 'AVAILABLE' },
        },
      },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    }),
    prisma.spaces.aggregate({
      where: {
        status: 'AVAILABLE',
        properties: {
          status: 'ACTIVE',
        },
      },
      _min: { price_amount: true },
      _max: { price_amount: true },
    }),
  ]);

  const cities = citiesData.map((c) => c.city).filter(Boolean);

  sendSuccess(res, {
    cities,
    spaceTypes: SPACE_TYPES,
    priceRange: {
      min: priceAgg._min.price_amount ? Number(priceAgg._min.price_amount) : 0,
      max: priceAgg._max.price_amount ? Number(priceAgg._max.price_amount) : 0,
    },
  });
}
