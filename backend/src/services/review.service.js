import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { createNotification } from './notification.service.js';

/**
 * @typedef {Object} CreateReviewInput
 * @property {string} bookingId - UUID of the completed booking
 * @property {string} customerId - UUID of the customer leaving the review
 * @property {number} rating - Integer rating from 1 to 5
 * @property {string} [comment] - Optional review comment
 */

/**
 * Creates a verified review for a completed space booking.
 * Enforces one-review-per-booking and triggers owner notification.
 * @param {CreateReviewInput} input - Review parameters
 * @returns {Promise<any>} Created space review record
 */
export async function createSpaceReview(input) {
  const { bookingId, customerId, rating, comment } = input;

  const booking = await prisma.bookings.findUnique({
    where: { id: bookingId },
    include: {
      spaces: {
        include: {
          properties: true,
        },
      },
      space_reviews: true,
    },
  });

  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }

  if (booking.customer_id !== customerId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the customer who made the booking can submit a review');
  }

  if (booking.status !== 'COMPLETED') {
    throw new AppError(
      409,
      'BOOKING_NOT_COMPLETED',
      `Reviews can only be submitted for completed bookings (current status: ${booking.status})`
    );
  }

  if (booking.space_reviews) {
    throw new AppError(409, 'ALREADY_REVIEWED', 'This booking has already been reviewed');
  }

  try {
    const review = await prisma.space_reviews.create({
      data: {
        booking_id: booking.id,
        customer_id: customerId,
        space_id: booking.space_id,
        rating,
        comment: comment?.trim() || null,
      },
      include: {
        profiles: {
          select: {
            name: true,
          },
        },
      },
    });

    // Notify the space owner
    createNotification({
      userId: booking.spaces.properties.owner_id,
      type: 'REVIEW_RECEIVED',
      title: 'New Review Received',
      message: `A new ${rating}-star review was posted for ${booking.spaces.name}`,
      linkUrl: `/spaces/${booking.space_id}`,
    });

    return review;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'ALREADY_REVIEWED', 'This booking has already been reviewed');
    }
    throw err;
  }
}
