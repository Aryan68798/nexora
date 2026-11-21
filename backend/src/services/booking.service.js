import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { calculatePrice } from './pricing.service.js';
import { createNotification } from './notification.service.js';

/**
 * @typedef {Object} CreateBookingInput
 * @property {string} spaceId - Space UUID
 * @property {string} customerId - Customer user UUID
 * @property {Date} startAt - Start timestamp
 * @property {Date} endAt - End timestamp
 * @property {number} guestCount - Number of guests
 */

/**
 * @typedef {Object} QuoteBookingInput
 * @property {string} spaceId - Space UUID
 * @property {Date} startAt - Start timestamp
 * @property {Date} endAt - End timestamp
 * @property {number} guestCount - Number of guests
 */

/**
 * @typedef {Object} BookingQuoteResult
 * @property {import('./pricing.service.js').CalculatePriceOutput} pricing - Pricing breakdown
 * @property {boolean} isAvailable - Availability flag
 * @property {{ id: string, name: string, spaceType: string, capacity: number | null }} space - Space details
 */

/**
 * Validates booking parameters against lead time, duration, and capacity.
 * @param {Date} startAt - Booking start timestamp
 * @param {Date} endAt - Booking end timestamp
 */
function validateBookingDates(startAt, endAt) {
  const now = new Date();
  const minLeadMs = env.MIN_BOOKING_LEAD_MINUTES * 60 * 1000;
  const maxDurationMs = env.MAX_BOOKING_DAYS * 24 * 60 * 60 * 1000;

  if (endAt.getTime() <= startAt.getTime()) {
    throw new AppError(400, 'INVALID_DATES', 'endAt must be strictly greater than startAt');
  }

  if (startAt.getTime() < now.getTime() + minLeadMs) {
    throw new AppError(
      400,
      'LEAD_TIME_VIOLATION',
      `Bookings must be made at least ${env.MIN_BOOKING_LEAD_MINUTES} minutes in advance`
    );
  }

  if (endAt.getTime() - startAt.getTime() > maxDurationMs) {
    throw new AppError(
      400,
      'DURATION_EXCEEDED',
      `Booking duration cannot exceed ${env.MAX_BOOKING_DAYS} days`
    );
  }
}

/**
 * Generates a quote for a prospective booking without persisting any data.
 * @param {QuoteBookingInput} input - Quote parameters
 * @returns {Promise<BookingQuoteResult>} Pricing calculation and availability status
 */
export async function getBookingQuote(input) {
  validateBookingDates(input.startAt, input.endAt);

  const space = await prisma.spaces.findUnique({
    where: { id: input.spaceId },
    include: { properties: true },
  });

  if (!space || space.status !== 'AVAILABLE' || space.properties.status !== 'ACTIVE') {
    throw new AppError(404, 'NOT_FOUND', 'Space not found or unavailable');
  }

  if (space.capacity !== null && input.guestCount > space.capacity) {
    throw new AppError(
      400,
      'CAPACITY_EXCEEDED',
      `Guest count (${input.guestCount}) exceeds space capacity (${space.capacity})`
    );
  }

  const pricing = calculatePrice({
    priceAmount: space.price_amount,
    priceUnit: space.price_unit,
    startAt: input.startAt,
    endAt: input.endAt,
  });

  // Check overlap with active bookings
  const overlapping = await prisma.bookings.findFirst({
    where: {
      space_id: input.spaceId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      start_at: { lt: input.endAt },
      end_at: { gt: input.startAt },
    },
  });

  return {
    pricing,
    isAvailable: !overlapping,
    space: {
      id: space.id,
      name: space.name,
      spaceType: space.space_type,
      capacity: space.capacity,
    },
  };
}

/**
 * Creates a new booking in PENDING status with concurrency lock and overlap validation.
 * @param {CreateBookingInput} input - Booking creation parameters
 * @param {string} callerRole - Authenticated user role
 * @returns {Promise<any>} Created booking record
 */
export async function createBooking(input, callerRole) {
  if (callerRole !== 'CUSTOMER') {
    throw new AppError(403, 'FORBIDDEN', 'Only customers can create space bookings');
  }

  validateBookingDates(input.startAt, input.endAt);

  const space = await prisma.spaces.findUnique({
    where: { id: input.spaceId },
    include: { properties: true },
  });

  if (!space || space.status !== 'AVAILABLE' || space.properties.status !== 'ACTIVE') {
    throw new AppError(404, 'NOT_FOUND', 'Space not found or unavailable');
  }

  if (space.properties.owner_id === input.customerId) {
    throw new AppError(400, 'OWN_PROPERTY', 'You cannot book a space in your own property');
  }

  if (space.capacity !== null && input.guestCount > space.capacity) {
    throw new AppError(
      400,
      'CAPACITY_EXCEEDED',
      `Guest count (${input.guestCount}) exceeds space capacity (${space.capacity})`
    );
  }

  const pricing = calculatePrice({
    priceAmount: space.price_amount,
    priceUnit: space.price_unit,
    startAt: input.startAt,
    endAt: input.endAt,
  });

  // Execute in a transaction with row lock
  const booking = await prisma.$transaction(async (tx) => {
    // 1. Lock space row FOR UPDATE using parameterized Prisma raw query
    await tx.$queryRaw`SELECT id FROM spaces WHERE id = ${input.spaceId}::uuid FOR UPDATE`;

    // 2. Concurrency check for overlapping PENDING or CONFIRMED bookings
    const overlap = await tx.bookings.findFirst({
      where: {
        space_id: input.spaceId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        start_at: { lt: input.endAt },
        end_at: { gt: input.startAt },
      },
    });

    if (overlap) {
      throw new AppError(409, 'SLOT_UNAVAILABLE', 'The selected time slot is already booked');
    }

    // 3. Create booking
    const newBooking = await tx.bookings.create({
      data: {
        space_id: input.spaceId,
        customer_id: input.customerId,
        start_at: input.startAt,
        end_at: input.endAt,
        guest_count: input.guestCount,
        status: 'PENDING',
        base_amount: pricing.subtotal,
        platform_fee: pricing.platformFee,
        tax_amount: pricing.taxAmount,
        total_amount: pricing.totalAmount,
        owner_amount: pricing.ownerAmount,
      },
      include: {
        spaces: {
          include: {
            properties: true,
          },
        },
      },
    });

    // 4. Record initial status history
    await tx.booking_status_history.create({
      data: {
        booking_id: newBooking.id,
        from_status: null,
        status: 'PENDING',
        changed_by: input.customerId,
        note: 'Booking requested by customer',
      },
    });

    return newBooking;
  });

  // Post-commit notification to property owner
  createNotification({
    userId: space.properties.owner_id,
    type: 'BOOKING_REQUESTED',
    title: 'New Booking Request',
    message: `You have received a new booking request for ${space.name}`,
    linkUrl: `/owner/bookings?id=${booking.id}`,
  });

  return booking;
}

/**
 * @typedef {Object} TransitionBookingInput
 * @property {string} bookingId - Booking UUID
 * @property {string} newStatus - New status ('CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED')
 * @property {string} [reason] - Optional cancellation/rejection reason
 * @property {{ id: string, role: string }} caller - Authenticated user details
 */

/**
 * Transitions booking status according to the strict state machine.
 * @param {TransitionBookingInput} input - Transition parameters
 * @returns {Promise<{ booking: any, refundedAmount: import('@prisma/client').Prisma.Decimal }>}
 */
export async function transitionBookingStatus(input) {
  const { bookingId, newStatus, reason, caller } = input;

  return prisma.$transaction(async (tx) => {
    // 1. Lock the booking row FOR UPDATE
    await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId}::uuid FOR UPDATE`;

    const booking = await tx.bookings.findUnique({
      where: { id: bookingId },
      include: {
        spaces: {
          include: {
            properties: true,
          },
        },
        payments: true,
      },
    });

    if (!booking) {
      throw new AppError(404, 'NOT_FOUND', 'Booking not found');
    }

    const isCustomer = caller.id === booking.customer_id;
    const isOwner = caller.id === booking.spaces.properties.owner_id;
    const isAdmin = caller.role === 'ADMIN';

    if (!isCustomer && !isOwner && !isAdmin) {
      throw new AppError(404, 'NOT_FOUND', 'Booking not found');
    }

    const currentStatus = booking.status;
    const now = new Date();
    let historyNote = reason ?? null;
    let refundedAmount = new Prisma.Decimal(0);

    // Validate transition table
    switch (currentStatus) {
      case 'PENDING': {
        if (newStatus === 'CONFIRMED') {
          if (!isOwner && !isAdmin) {
            throw new AppError(403, 'FORBIDDEN', 'Only the space owner or admin can confirm bookings');
          }
          // Re-check for overlap with CONFIRMED bookings
          const overlap = await tx.bookings.findFirst({
            where: {
              space_id: booking.space_id,
              status: 'CONFIRMED',
              id: { not: booking.id },
              start_at: { lt: booking.end_at },
              end_at: { gt: booking.start_at },
            },
          });
          if (overlap) {
            throw new AppError(
              409,
              'SLOT_UNAVAILABLE',
              'Cannot confirm: an overlapping booking was already confirmed'
            );
          }
          historyNote = historyNote ?? 'Booking confirmed by owner';
        } else if (newStatus === 'REJECTED') {
          if (!isOwner && !isAdmin) {
            throw new AppError(403, 'FORBIDDEN', 'Only the space owner or admin can reject bookings');
          }
          historyNote = historyNote ?? 'Booking rejected by owner';
          // Refund any payments
          const paidPayments = booking.payments.filter((p) => p.status === 'PAID');
          if (paidPayments.length > 0) {
            await tx.payments.updateMany({
              where: { booking_id: booking.id, status: 'PAID' },
              data: { status: 'REFUNDED' },
            });
            refundedAmount = paidPayments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
            historyNote = `${historyNote}. Refund: full`;
          }
        } else if (newStatus === 'CANCELLED') {
          // PENDING -> CANCELLED allowed for customer, owner, or admin
          const actor = isCustomer ? 'customer' : isOwner ? 'owner' : 'admin';
          historyNote = historyNote ?? `Booking cancelled by ${actor}`;
          const paidPayments = booking.payments.filter((p) => p.status === 'PAID');
          if (paidPayments.length > 0) {
            await tx.payments.updateMany({
              where: { booking_id: booking.id, status: 'PAID' },
              data: { status: 'REFUNDED' },
            });
            refundedAmount = paidPayments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
            historyNote = `${historyNote}. Refund: full`;
          }
        } else {
          throw new AppError(409, 'INVALID_TRANSITION', `Cannot transition from PENDING to ${newStatus}`);
        }
        break;
      }

      case 'CONFIRMED': {
        if (newStatus === 'CANCELLED') {
          let isFullRefund = false;
          if (isOwner || isAdmin) {
            isFullRefund = true;
          } else if (isCustomer) {
            if (now.getTime() >= booking.start_at.getTime()) {
              throw new AppError(
                400,
                'CANCELLATION_WINDOW_PASSED',
                'Customers cannot cancel a confirmed booking after start time'
              );
            }
            const hoursUntilStart =
              (booking.start_at.getTime() - now.getTime()) / (1000 * 60 * 60);
            isFullRefund = hoursUntilStart >= env.FREE_CANCELLATION_HOURS;
          }

          const actor = isCustomer ? 'customer' : isOwner ? 'owner' : 'admin';
          const refundNote = isFullRefund ? 'full' : 'none';
          historyNote = historyNote
            ? `${historyNote}. Refund: ${refundNote}`
            : `Cancelled by ${actor}. Refund: ${refundNote}`;

          if (isFullRefund) {
            const paidPayments = booking.payments.filter((p) => p.status === 'PAID');
            if (paidPayments.length > 0) {
              await tx.payments.updateMany({
                where: { booking_id: booking.id, status: 'PAID' },
                data: { status: 'REFUNDED' },
              });
              refundedAmount = paidPayments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
            }
          }
        } else if (newStatus === 'COMPLETED') {
          if (!isOwner && !isAdmin) {
            throw new AppError(403, 'FORBIDDEN', 'Only the owner or admin can complete bookings');
          }
          if (now.getTime() < booking.end_at.getTime()) {
            throw new AppError(
              409,
              'BOOKING_NOT_ENDED',
              'Cannot mark booking as completed before its scheduled end time'
            );
          }
          historyNote = historyNote ?? 'Booking completed';
        } else {
          throw new AppError(409, 'INVALID_TRANSITION', `Cannot transition from CONFIRMED to ${newStatus}`);
        }
        break;
      }

      case 'CANCELLED':
      case 'REJECTED':
      case 'COMPLETED':
      default:
        throw new AppError(
          409,
          'INVALID_TRANSITION',
          `Booking in terminal status ${currentStatus} cannot be modified`
        );
    }

    // Update booking row
    const updated = await tx.bookings.update({
      where: { id: booking.id },
      data: {
        status: newStatus,
        cancellation_reason: reason ?? booking.cancellation_reason,
      },
      include: {
        spaces: {
          include: {
            properties: true,
          },
        },
        payments: true,
      },
    });

    // Write history entry
    await tx.booking_status_history.create({
      data: {
        booking_id: booking.id,
        from_status: currentStatus,
        status: newStatus,
        changed_by: caller.id,
        note: historyNote,
      },
    });

    // Send post-commit notifications
    const targetUserId = isCustomer ? booking.spaces.properties.owner_id : booking.customer_id;
    if (newStatus === 'CONFIRMED') {
      createNotification({
        userId: booking.customer_id,
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed',
        message: `Your booking for ${booking.spaces.name} has been confirmed`,
        linkUrl: `/bookings/${booking.id}`,
      });
    } else if (newStatus === 'REJECTED') {
      createNotification({
        userId: booking.customer_id,
        type: 'BOOKING_REJECTED',
        title: 'Booking Request Declined',
        message: `Your booking request for ${booking.spaces.name} was declined`,
        linkUrl: `/bookings/${booking.id}`,
      });
    } else if (newStatus === 'CANCELLED') {
      createNotification({
        userId: targetUserId,
        type: 'BOOKING_CANCELLED',
        title: 'Booking Cancelled',
        message: `Booking for ${booking.spaces.name} has been cancelled`,
        linkUrl: `/bookings/${booking.id}`,
      });
      if (refundedAmount.gt(0)) {
        createNotification({
          userId: booking.customer_id,
          type: 'PAYMENT_REFUNDED',
          title: 'Payment Refunded',
          message: `A full refund of ₹${refundedAmount.toFixed(2)} has been issued for your booking`,
          linkUrl: `/bookings/${booking.id}`,
        });
      }
    } else if (newStatus === 'COMPLETED') {
      createNotification({
        userId: booking.customer_id,
        type: 'BOOKING_COMPLETED',
        title: 'Booking Completed',
        message: `Your booking for ${booking.spaces.name} is now complete. Please leave a review!`,
        linkUrl: `/bookings/${booking.id}`,
      });
    }

    return {
      booking: updated,
      refundedAmount,
    };
  });
}

/**
 * Expire stale PENDING bookings whose start time has passed.
 * @returns {Promise<number>} Count of expired bookings
 */
export async function expireStaleBookings() {
  const now = new Date();
  const staleBookings = await prisma.bookings.findMany({
    where: {
      status: 'PENDING',
      start_at: { lt: now },
    },
    include: {
      spaces: {
        include: { properties: true },
      },
    },
  });

  let count = 0;
  for (const b of staleBookings) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.bookings.update({
          where: { id: b.id },
          data: {
            status: 'CANCELLED',
            cancellation_reason: 'Expired: not approved before start time',
          },
        });

        await tx.booking_status_history.create({
          data: {
            booking_id: b.id,
            from_status: 'PENDING',
            status: 'CANCELLED',
            changed_by: b.customer_id,
            note: 'Expired: not approved before start time',
          },
        });
      });

      createNotification({
        userId: b.customer_id,
        type: 'BOOKING_CANCELLED',
        title: 'Booking Request Expired',
        message: `Your pending booking request for ${b.spaces.name} expired as it was not approved before start time`,
      });

      count++;
    } catch {
      // Continue expiring other bookings
    }
  }

  return count;
}

/**
 * Derives allowed next actions for a caller inspecting a booking.
 * @param {{ status: string, start_at: Date, end_at: Date, customer_id: string, spaces: { properties: { owner_id: string } }, space_reviews?: any, payments?: any[], total_amount: import('@prisma/client').Prisma.Decimal }} booking - Booking record
 * @param {{ id: string, role: string }} caller - Authenticated user details
 * @returns {string[]} List of allowed actions ('confirm', 'reject', 'cancel', 'pay', 'review', 'complete')
 */
export function getAllowedNextActions(booking, caller) {
  const actions = [];
  const now = new Date();
  const isCustomer = caller.id === booking.customer_id;
  const isOwner = caller.id === booking.spaces.properties.owner_id;
  const isAdmin = caller.role === 'ADMIN';

  if (isCustomer) {
    if (booking.status === 'PENDING') {
      actions.push('cancel');
    } else if (booking.status === 'CONFIRMED') {
      if (now.getTime() < booking.start_at.getTime()) {
        actions.push('cancel');
      }
      const paidTotal = (booking.payments ?? [])
        .filter((p) => p.status === 'PAID')
        .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
      if (paidTotal.lt(booking.total_amount)) {
        actions.push('pay');
      }
    } else if (booking.status === 'COMPLETED' && !booking.space_reviews) {
      actions.push('review');
    }
  }

  if (isOwner || isAdmin) {
    if (booking.status === 'PENDING') {
      actions.push('confirm', 'reject', 'cancel');
    } else if (booking.status === 'CONFIRMED') {
      if (now.getTime() >= booking.end_at.getTime()) {
        actions.push('complete', 'cancel');
      } else {
        actions.push('cancel');
      }
    }
  }

  return actions;
}
