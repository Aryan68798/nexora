import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  getBookingQuote,
  createBooking,
  transitionBookingStatus,
  expireStaleBookings,
  getAllowedNextActions,
} from '../services/booking.service.js';

/**
 * Helper to serialize a booking entity into standard API shape
 */
function serializeBookingItem(b) {
  const paidAmount = (b.payments ?? [])
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

  const coverImageUrl =
    b.spaces?.space_media?.find((m) => m.is_cover)?.url ||
    b.spaces?.space_media?.[0]?.url ||
    null;

  return {
    id: b.id,
    spaceId: b.space_id,
    customerId: b.customer_id,
    startAt: b.start_at,
    endAt: b.end_at,
    guestCount: b.guest_count,
    status: b.status,
    subtotal: b.base_amount,
    platformFee: b.platform_fee,
    taxAmount: b.tax_amount,
    totalAmount: b.total_amount,
    ownerAmount: b.owner_amount,
    paidAmount,
    cancellationReason: b.cancellation_reason,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
    space: b.spaces
      ? {
          id: b.spaces.id,
          name: b.spaces.name,
          spaceType: b.spaces.space_type,
          capacity: b.spaces.capacity,
          priceAmount: b.spaces.price_amount,
          priceUnit: b.spaces.price_unit,
          coverImageUrl,
          property: b.spaces.properties
            ? {
                id: b.spaces.properties.id,
                title: b.spaces.properties.title,
                city: b.spaces.properties.city,
                state: b.spaces.properties.state,
                addressLine1: b.spaces.properties.address_line1,
              }
            : undefined,
        }
      : undefined,
  };
}

export async function quoteBookingHandler(req, res) {
  const body = req.body;
  const quote = await getBookingQuote({
    spaceId: body.spaceId,
    startAt: new Date(body.startAt),
    endAt: new Date(body.endAt),
    guestCount: body.guestCount,
  });

  sendSuccess(res, quote);
}

export async function createBookingHandler(req, res) {
  const body = req.body;
  const booking = await createBooking(
    {
      spaceId: body.spaceId,
      customerId: req.user.id,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      guestCount: body.guestCount,
    },
    req.user.role
  );

  sendSuccess(res, serializeBookingItem(booking), 201);
}

export async function getMyBookingsHandler(req, res) {
  await expireStaleBookings();

  const query = req.query;
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where = {
    customer_id: req.user.id,
  };

  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.start_at = {};
    if (query.from) where.start_at.gte = new Date(query.from);
    if (query.to) where.start_at.lte = new Date(query.to);
  }

  const [total, items] = await Promise.all([
    prisma.bookings.count({ where }),
    prisma.bookings.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { created_at: 'desc' },
      include: {
        spaces: {
          include: {
            properties: true,
            space_media: true,
          },
        },
        payments: true,
      },
    }),
  ]);

  const data = items.map(serializeBookingItem);
  sendSuccess(res, data, 200, buildPaginationMeta(page, pageSize, total));
}

export async function getOwnerBookingsHandler(req, res) {
  await expireStaleBookings();

  const query = req.query;
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const spacesWhere = {
    properties: {
      owner_id: req.user.id,
    },
  };
  if (query.propertyId) spacesWhere.property_id = query.propertyId;

  const where = {
    spaces: spacesWhere,
  };

  if (query.status) where.status = query.status;
  if (query.spaceId) where.space_id = query.spaceId;
  if (query.from || query.to) {
    where.start_at = {};
    if (query.from) where.start_at.gte = new Date(query.from);
    if (query.to) where.start_at.lte = new Date(query.to);
  }

  const [total, items] = await Promise.all([
    prisma.bookings.count({ where }),
    prisma.bookings.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { created_at: 'desc' },
      include: {
        profiles: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        spaces: {
          include: {
            properties: true,
            space_media: true,
          },
        },
        payments: true,
      },
    }),
  ]);

  const data = items.map((b) => ({
    ...serializeBookingItem(b),
    customer: {
      id: b.profiles.id,
      name: b.profiles.name,
      phone: b.profiles.phone,
    },
  }));

  sendSuccess(res, data, 200, buildPaginationMeta(page, pageSize, total));
}

export async function getAdminBookingsHandler(req, res) {
  await expireStaleBookings();

  const query = req.query;
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where = {};
  if (query.status) where.status = query.status;
  if (query.propertyId) where.spaces = { property_id: query.propertyId };
  if (query.spaceId) where.space_id = query.spaceId;
  if (query.from || query.to) {
    where.start_at = {};
    if (query.from) where.start_at.gte = new Date(query.from);
    if (query.to) where.start_at.lte = new Date(query.to);
  }

  const [total, items] = await Promise.all([
    prisma.bookings.count({ where }),
    prisma.bookings.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { created_at: 'desc' },
      include: {
        profiles: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        spaces: {
          include: {
            properties: true,
            space_media: true,
          },
        },
        payments: true,
      },
    }),
  ]);

  const data = items.map((b) => ({
    ...serializeBookingItem(b),
    customer: b.profiles,
  }));

  sendSuccess(res, data, 200, buildPaginationMeta(page, pageSize, total));
}

export async function getBookingByIdHandler(req, res) {
  const { id } = req.params;
  const currentUser = req.user;

  const booking = await prisma.bookings.findUnique({
    where: { id },
    include: {
      profiles: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      spaces: {
        include: {
          properties: true,
          space_media: {
            orderBy: { sort_order: 'asc' },
          },
        },
      },
      payments: {
        orderBy: { created_at: 'desc' },
      },
      booking_status_history: {
        orderBy: { changed_at: 'desc' },
        include: {
          profiles: {
            select: { id: true, name: true, role: true },
          },
        },
      },
      space_reviews: true,
    },
  });

  if (!booking) {
    throw AppError.notFound('Booking not found');
  }

  const isCustomer = currentUser.id === booking.customer_id;
  const isOwner = currentUser.id === booking.spaces.properties.owner_id;
  const isAdmin = currentUser.role === 'ADMIN';

  if (!isCustomer && !isOwner && !isAdmin) {
    throw AppError.notFound('Booking not found');
  }

  const allowedNextActions = getAllowedNextActions(
    {
      status: booking.status,
      start_at: booking.start_at,
      end_at: booking.end_at,
      customer_id: booking.customer_id,
      spaces: booking.spaces,
      space_reviews: booking.space_reviews,
      payments: booking.payments,
      total_amount: booking.total_amount,
    },
    { id: currentUser.id, role: currentUser.role }
  );

  const customerData = isOwner
    ? {
        id: booking.profiles.id,
        name: booking.profiles.name,
        phone: booking.profiles.phone,
      }
    : booking.profiles;

  const responseData = {
    ...serializeBookingItem(booking),
    customer: customerData,
    payments: booking.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      paymentMethod: p.payment_method,
      status: p.status,
      transactionReference: p.transaction_reference,
      paidAt: p.paid_at,
      createdAt: p.created_at,
    })),
    statusHistory: booking.booking_status_history.map((h) => ({
      id: h.id,
      fromStatus: h.from_status,
      status: h.status,
      changedBy: h.profiles?.name || 'System',
      note: h.note,
      changedAt: h.changed_at,
    })),
    review: booking.space_reviews
      ? {
          id: booking.space_reviews.id,
          rating: booking.space_reviews.rating,
          comment: booking.space_reviews.comment,
          createdAt: booking.space_reviews.created_at,
        }
      : null,
    allowedNextActions,
  };

  sendSuccess(res, responseData);
}

export async function transitionBookingStatusHandler(req, res) {
  const { id } = req.params;
  const body = req.body;

  const result = await transitionBookingStatus({
    bookingId: id,
    newStatus: body.status,
    reason: body.reason,
    caller: {
      id: req.user.id,
      role: req.user.role,
    },
  });

  sendSuccess(res, {
    booking: serializeBookingItem(result.booking),
    refundedAmount: result.refundedAmount.toFixed(2),
  });
}

export async function getSpaceAvailabilityHandler(req, res) {
  const { id } = req.params;
  const query = req.query;

  const space = await prisma.spaces.findUnique({
    where: { id },
    include: { properties: true },
  });

  if (!space || space.status !== 'AVAILABLE' || space.properties.status !== 'ACTIVE') {
    throw AppError.notFound('Space not found or unavailable');
  }

  const fromDate = new Date(query.from);
  const toDate = new Date(query.to);

  const bookings = await prisma.bookings.findMany({
    where: {
      space_id: id,
      status: { in: ['PENDING', 'CONFIRMED'] },
      start_at: { lt: toDate },
      end_at: { gt: fromDate },
    },
    select: {
      start_at: true,
      end_at: true,
    },
    orderBy: { start_at: 'asc' },
  });

  const blockedSlots = bookings.map((b) => ({
    startAt: b.start_at,
    endAt: b.end_at,
  }));

  sendSuccess(res, blockedSlots);
}
