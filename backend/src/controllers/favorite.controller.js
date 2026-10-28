import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

export async function getMyFavorites(req, res) {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const customerId = req.user.id;

  const where = {
    customer_id: customerId,
    spaces: {
      status: 'AVAILABLE',
      properties: {
        status: 'ACTIVE',
      },
    },
  };

  const [total, favs] = await Promise.all([
    prisma.favorites.count({ where }),
    prisma.favorites.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' },
      include: {
        spaces: {
          include: {
            properties: {
              select: {
                id: true,
                title: true,
                city: true,
                state: true,
              },
            },
            space_media: {
              where: { is_cover: true },
              select: { url: true },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  const spaceIds = favs.map((f) => f.spaces.id);

  // GroupBy for ratings across the favorited spaces
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

  const items = favs.map((f) => {
    const s = f.spaces;
    const stats = ratingMap.get(s.id) || { average: null, count: 0 };
    return {
      id: s.id,
      name: s.name,
      spaceType: s.space_type,
      capacity: s.capacity,
      priceAmount: s.price_amount,
      priceUnit: s.price_unit,
      property: s.properties,
      coverImageUrl: s.space_media[0]?.url || null,
      averageRating: stats.average,
      reviewCount: stats.count,
      isFavorite: true,
    };
  });

  sendSuccess(res, items, 200, buildPaginationMeta(page, pageSize, total));
}

export async function addFavorite(req, res) {
  const { spaceId } = req.params;
  const customerId = req.user.id;

  // Check space exists and is publicly visible
  const space = await prisma.spaces.findUnique({
    where: { id: spaceId },
    include: {
      properties: {
        select: { status: true },
      },
    },
  });

  if (!space || space.status !== 'AVAILABLE' || space.properties.status !== 'ACTIVE') {
    throw AppError.notFound('Space not found');
  }

  await prisma.favorites.upsert({
    where: {
      customer_id_space_id: {
        customer_id: customerId,
        space_id: spaceId,
      },
    },
    create: {
      customer_id: customerId,
      space_id: spaceId,
    },
    update: {},
  });

  sendSuccess(res, { favorited: true });
}

export async function removeFavorite(req, res) {
  const { spaceId } = req.params;
  const customerId = req.user.id;

  await prisma.favorites.deleteMany({
    where: {
      customer_id: customerId,
      space_id: spaceId,
    },
  });

  sendSuccess(res, { favorited: false });
}
