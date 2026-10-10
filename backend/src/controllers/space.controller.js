import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { assertOwnsProperty, assertOwnsSpace } from '../utils/ownership.js';

export async function createSpace(req, res) {
  const { propertyId } = req.params;
  const input = req.body;

  const property = await prisma.properties.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw AppError.notFound('Property not found');
  }

  if (req.user.role !== 'ADMIN') {
    assertOwnsProperty(property, req.user.id);
  }

  const space = await prisma.spaces.create({
    data: {
      property_id: propertyId,
      name: input.name,
      description: input.description ?? null,
      space_type: input.spaceType,
      capacity: input.capacity,
      price_amount: input.priceAmount,
      price_unit: input.priceUnit,
      rules: input.rules ?? null,
      status: input.status ?? 'AVAILABLE',
    },
  });

  sendSuccess(res, space, 201);
}

export async function getSpacesByProperty(req, res) {
  const { propertyId } = req.params;
  const currentUser = req.user;

  const property = await prisma.properties.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    throw AppError.notFound('Property not found');
  }

  const isOwnerOrAdmin =
    currentUser && (property.owner_id === currentUser.id || currentUser.role === 'ADMIN');

  // If public caller and property is not ACTIVE -> 404
  if (!isOwnerOrAdmin && property.status !== 'ACTIVE') {
    throw AppError.notFound('Property not found');
  }

  const where = {
    property_id: propertyId,
  };

  // If not owner/admin, only AVAILABLE spaces
  if (!isOwnerOrAdmin) {
    where.status = 'AVAILABLE';
  }

  const spaces = await prisma.spaces.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: {
      space_media: {
        orderBy: { sort_order: 'asc' },
      },
    },
  });

  const data = spaces.map((s) => ({
    id: s.id,
    propertyId: s.property_id,
    name: s.name,
    description: s.description,
    spaceType: s.space_type,
    capacity: s.capacity,
    priceAmount: s.price_amount,
    priceUnit: s.price_unit,
    status: s.status,
    rules: s.rules,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    media: s.space_media,
    coverImageUrl: s.space_media.find((m) => m.is_cover)?.url || s.space_media[0]?.url || null,
  }));

  sendSuccess(res, data);
}

export async function updateSpace(req, res) {
  const { id } = req.params;
  const input = req.body;

  const space = await prisma.spaces.findUnique({
    where: { id },
    include: {
      properties: {
        select: { owner_id: true },
      },
    },
  });

  if (!space) {
    throw AppError.notFound('Space not found');
  }

  if (req.user.role !== 'ADMIN') {
    assertOwnsSpace(space, req.user.id);
  }

  const dataToUpdate = {};

  if (input.name !== undefined) dataToUpdate.name = input.name;
  if (input.description !== undefined) dataToUpdate.description = input.description;
  if (input.spaceType !== undefined) dataToUpdate.space_type = input.spaceType;
  if (input.capacity !== undefined) dataToUpdate.capacity = input.capacity;
  if (input.priceAmount !== undefined) dataToUpdate.price_amount = input.priceAmount;
  if (input.priceUnit !== undefined) dataToUpdate.price_unit = input.priceUnit;
  if (input.rules !== undefined) dataToUpdate.rules = input.rules;
  if (input.status !== undefined) {
    if (input.status === 'UNAVAILABLE' && space.status !== 'UNAVAILABLE') {
      const activeBooking = await prisma.bookings.findFirst({
        where: {
          space_id: id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          end_at: { gt: new Date() },
        },
      });
      if (activeBooking) {
        throw new AppError(
          409,
          'HAS_ACTIVE_BOOKINGS',
          'Cannot set space to UNAVAILABLE with active future bookings'
        );
      }
    }
    dataToUpdate.status = input.status;
  }

  const updated = await prisma.spaces.update({
    where: { id },
    data: dataToUpdate,
  });

  sendSuccess(res, updated);
}

export async function deleteSpace(req, res) {
  const { id } = req.params;

  const space = await prisma.spaces.findUnique({
    where: { id },
    include: {
      properties: {
        select: { owner_id: true },
      },
    },
  });

  if (!space) {
    throw AppError.notFound('Space not found');
  }

  if (req.user.role !== 'ADMIN') {
    assertOwnsSpace(space, req.user.id);
  }

  const activeBooking = await prisma.bookings.findFirst({
    where: {
      space_id: id,
      status: { in: ['PENDING', 'CONFIRMED'] },
      end_at: { gt: new Date() },
    },
  });
  if (activeBooking) {
    throw new AppError(
      409,
      'HAS_ACTIVE_BOOKINGS',
      'Cannot delete space with active future bookings'
    );
  }

  // Soft delete: sets status UNAVAILABLE
  const updated = await prisma.spaces.update({
    where: { id },
    data: { status: 'UNAVAILABLE' },
  });

  sendSuccess(res, updated);
}
