import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { bookingRateLimiter } from '../middleware/rateLimit.js';
import {
  quoteBookingHandler,
  createBookingHandler,
  getMyBookingsHandler,
  getAdminBookingsHandler,
  getBookingByIdHandler,
  transitionBookingStatusHandler,
} from '../controllers/booking.controller.js';
import {
  createPaymentHandler,
  getPaymentsHandler,
} from '../controllers/payment.controller.js';
import { createReviewHandler } from '../controllers/review.controller.js';
import {
  quoteBookingBodySchema,
  createBookingBodySchema,
  transitionBookingBodySchema,
  bookingIdParamSchema,
  listBookingsQuerySchema,
} from '../validators/booking.validator.js';
import { createPaymentBodySchema } from '../validators/payment.validator.js';
import { createReviewBodySchema } from '../validators/review.validator.js';

const router = Router();

// Pricing quote (no persistence)
router.post(
  '/quote',
  requireAuth,
  requireRole('CUSTOMER'),
  validate({ body: quoteBookingBodySchema }),
  asyncHandler(quoteBookingHandler)
);

// Create booking (CUSTOMER only, 10 req/min)
router.post(
  '/',
  requireAuth,
  requireRole('CUSTOMER'),
  bookingRateLimiter,
  validate({ body: createBookingBodySchema }),
  asyncHandler(createBookingHandler)
);

// Customer's own bookings
router.get(
  '/mine',
  requireAuth,
  requireRole('CUSTOMER'),
  validate({ query: listBookingsQuerySchema }),
  asyncHandler(getMyBookingsHandler)
);

// Admin listing of all bookings
router.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ query: listBookingsQuerySchema }),
  asyncHandler(getAdminBookingsHandler)
);

// Single booking detail view
router.get(
  '/:id',
  requireAuth,
  validate({ params: bookingIdParamSchema }),
  asyncHandler(getBookingByIdHandler)
);

// Status transition
router.patch(
  '/:id/status',
  requireAuth,
  validate({ params: bookingIdParamSchema, body: transitionBookingBodySchema }),
  asyncHandler(transitionBookingStatusHandler)
);

// Booking payments
router.post(
  '/:id/payments',
  requireAuth,
  requireRole('CUSTOMER'),
  validate({ params: bookingIdParamSchema, body: createPaymentBodySchema }),
  asyncHandler(createPaymentHandler)
);

router.get(
  '/:id/payments',
  requireAuth,
  validate({ params: bookingIdParamSchema }),
  asyncHandler(getPaymentsHandler)
);

// Booking review
router.post(
  '/:id/review',
  requireAuth,
  requireRole('CUSTOMER'),
  validate({ params: bookingIdParamSchema, body: createReviewBodySchema }),
  asyncHandler(createReviewHandler)
);

export default router;
