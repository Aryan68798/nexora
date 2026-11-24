import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { assertOwnsProperty } from '../utils/ownership.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';

export async function createProperty(req, res) {
  const input = req.body;
  const ownerId = req.user.id;

  const property = await prisma.properties.create({
    data: {
      owner_id: ownerId,
      title: input.title,
      description: input.description ?? null,
      property_type: input.propertyType,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2 ?? null,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      country: input.country ?? 'India',
      latitude: input.latitude !== undefined && input.latitude !== null ? new Prisma.Decimal(input.latitude) : null,
      longitude: input.longitude !== undefined && input.longitude !== null ? new Prisma.Decimal(input.longitude) : null,
      status: 'ACTIVE',
    },
  });

  sendSuccess(res, property, 201);
}

export async function getMyProperties(req, res) {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const { status, search } = req.query;

  const where = {
    owner_id: req.user.id,
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.properties.count({ where }),
    prisma.properties.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { spaces: true },
        },
        property_media: {
          where: { is_cover: true },
          select: { url: true },
          take: 1,
        },
      },
    }),
  ]);

  const data = items.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    propertyType: p.property_type,
    addressLine1: p.address_line1,
    addressLine2: p.address_line2,
    city: p.city,
    state: p.state,
    postalCode: p.postal_code,
    country: p.country,
    latitude: p.latitude,
    longitude: p.longitude,
    status: p.status,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    spaceCount: p._count.spaces,
    coverImageUrl: p.image_url || p.property_media[0]?.url || null,
  }));

  sendSuccess(res, data, 200, buildPaginationMeta(page, pageSize, total));
}

export async function getAdminProperties(req, res) {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const { status, city, search, ownerId } = req.query;

  const where = {};

  if (status) where.status = status;
  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (ownerId) where.owner_id = ownerId;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.properties.count({ where }),
    prisma.properties.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' },
      include: {
        profiles: {
          select: { id: true, name: true }, // NEVER expose email or phone publicly
        },
        _count: { select: { spaces: true } },
      },
    }),
  ]);

  const data = items.map((p) => ({
    ...p,
    spaceCount: p._count.spaces,
    owner: p.profiles,
  }));

  sendSuccess(res, data, 200, buildPaginationMeta(page, pageSize, total));
}

export async function getPropertyById(req, res) {
  const { id } = req.params;
  const currentUser = req.user;

  const property = await prisma.properties.findUnique({
    where: { id },
    include: {
      profiles: {
        select: { id: true, name: true }, // NEVER expose email or phone publicly
      },
      property_media: {
        orderBy: { sort_order: 'asc' },
      },
      spaces: {
        orderBy: { created_at: 'desc' },
        include: {
          space_media: {
            where: { is_cover: true },
            select: { url: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!property) {
    throw AppError.notFound('Property not found');
  }

  const isOwnerOrAdmin =
    currentUser && (property.owner_id === currentUser.id || currentUser.role === 'ADMIN');

  // If not ACTIVE, visible ONLY to owner and ADMIN; everyone else gets 404
  if (property.status !== 'ACTIVE' && !isOwnerOrAdmin) {
    throw AppError.notFound('Property not found');
  }

  // Filter spaces: public users only see AVAILABLE spaces
  const visibleSpaces = isOwnerOrAdmin
    ? property.spaces
    : property.spaces.filter((s) => s.status === 'AVAILABLE');

  const { profiles, spaces: _spaces, property_media, ...propertyData } = property;

  sendSuccess(res, {
    ...propertyData,
    coverImageUrl: property.image_url || property_media?.[0]?.url || null,
    owner: profiles,
    media: property_media,
    spaces: visibleSpaces.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      spaceType: s.space_type,
      capacity: s.capacity,
      priceAmount: s.price_amount,
      priceUnit: s.price_unit,
      status: s.status,
      rules: s.rules,
      coverImageUrl: s.space_media[0]?.url || null,
    })),
  });
}

export async function updateProperty(req, res) {
  const { id } = req.params;
  const input = req.body;

  const property = await prisma.properties.findUnique({ where: { id } });
  if (!property) {
    throw AppError.notFound('Property not found');
  }

  if (req.user.role !== 'ADMIN') {
    assertOwnsProperty(property, req.user.id);
  }

  const dataToUpdate = {};

  if (input.title !== undefined) dataToUpdate.title = input.title;
  if (input.description !== undefined) dataToUpdate.description = input.description;
  if (input.propertyType !== undefined) dataToUpdate.property_type = input.propertyType;
  if (input.addressLine1 !== undefined) dataToUpdate.address_line1 = input.addressLine1;
  if (input.addressLine2 !== undefined) dataToUpdate.address_line2 = input.addressLine2;
  if (input.city !== undefined) dataToUpdate.city = input.city;
  if (input.state !== undefined) dataToUpdate.state = input.state;
  if (input.postalCode !== undefined) dataToUpdate.postal_code = input.postalCode;
  if (input.country !== undefined) dataToUpdate.country = input.country;
  if (input.latitude !== undefined) {
    dataToUpdate.latitude = input.latitude !== null ? new Prisma.Decimal(input.latitude) : null;
  }
  if (input.longitude !== undefined) {
    dataToUpdate.longitude = input.longitude !== null ? new Prisma.Decimal(input.longitude) : null;
  }
  if (input.status !== undefined) {
    if (input.status === 'INACTIVE' && property.status !== 'INACTIVE') {
      const activeBooking = await prisma.bookings.findFirst({
        where: {
          spaces: { property_id: id },
          status: { in: ['PENDING', 'CONFIRMED'] },
          end_at: { gt: new Date() },
        },
      });
      if (activeBooking) {
        throw new AppError(
          409,
          'HAS_ACTIVE_BOOKINGS',
          'Cannot deactivate property with active future bookings'
        );
      }
    }
    dataToUpdate.status = input.status;
  }

  const updated = await prisma.properties.update({
    where: { id },
    data: dataToUpdate,
  });

  sendSuccess(res, updated);
}

export async function deleteProperty(req, res) {
  const { id } = req.params;

  const property = await prisma.properties.findUnique({ where: { id } });
  if (!property) {
    throw AppError.notFound('Property not found');
  }

  if (req.user.role !== 'ADMIN') {
    assertOwnsProperty(property, req.user.id);
  }

  const activeBooking = await prisma.bookings.findFirst({
    where: {
      spaces: { property_id: id },
      status: { in: ['PENDING', 'CONFIRMED'] },
      end_at: { gt: new Date() },
    },
  });
  if (activeBooking) {
    throw new AppError(
      409,
      'HAS_ACTIVE_BOOKINGS',
      'Cannot deactivate property with active future bookings'
    );
  }

  // Soft delete: property -> INACTIVE, spaces -> UNAVAILABLE in one transaction
  const [updatedProperty] = await prisma.$transaction([
    prisma.properties.update({
      where: { id },
      data: { status: 'INACTIVE' },
    }),
    prisma.spaces.updateMany({
      where: { property_id: id },
      data: { status: 'UNAVAILABLE' },
    }),
  ]);

  sendSuccess(res, updatedProperty);
}
