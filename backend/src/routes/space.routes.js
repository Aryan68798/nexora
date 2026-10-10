import { Router } from 'express';
import {
  searchSpaces,
  getSpaceById,
  getSpaceReviews,
} from '../controllers/search.controller.js';
import { updateSpace, deleteSpace } from '../controllers/space.controller.js';
import { uploadSpaceMedia } from '../controllers/media.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { handleSingleUpload, uploadMemory5MB } from '../middleware/upload.js';
import { uploadRateLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  spaceSearchQuerySchema,
  spaceReviewsQuerySchema,
} from '../validators/search.validator.js';
import {
  updateSpaceSchema,
  spaceIdParamSchema,
} from '../validators/space.validator.js';
import { spaceAvailabilityQuerySchema } from '../validators/booking.validator.js';
import { getSpaceAvailabilityHandler } from '../controllers/booking.controller.js';

const router = Router();

// Public space search with filters, sorting, ratings and favorite flags
router.get(
  '/',
  optionalAuth,
  validate({ query: spaceSearchQuerySchema }),
  asyncHandler(searchSpaces)
);

// Single space details
router.get(
  '/:id',
  optionalAuth,
  validate({ params: spaceIdParamSchema }),
  asyncHandler(getSpaceById)
);

// Update space (Owner or ADMIN)
router.patch(
  '/:id',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: spaceIdParamSchema, body: updateSpaceSchema }),
  asyncHandler(updateSpace)
);

// Soft delete space (Owner or ADMIN)
router.delete(
  '/:id',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: spaceIdParamSchema }),
  asyncHandler(deleteSpace)
);

// Paginated reviews for space
router.get(
  '/:id/reviews',
  validate({ params: spaceIdParamSchema, query: spaceReviewsQuerySchema }),
  asyncHandler(getSpaceReviews)
);

// Space availability (blocked intervals)
router.get(
  '/:id/availability',
  optionalAuth,
  validate({ params: spaceIdParamSchema, query: spaceAvailabilityQuerySchema }),
  asyncHandler(getSpaceAvailabilityHandler)
);

// Upload space media
router.post(
  '/:id/media',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  uploadRateLimiter,
  validate({ params: spaceIdParamSchema }),
  handleSingleUpload(uploadMemory5MB),
  asyncHandler(uploadSpaceMedia)
);

export default router;
