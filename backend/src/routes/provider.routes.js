import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  providerIdParamSchema,
  createProviderProfileSchema,
  updateProviderProfileSchema,
  listProvidersQuerySchema,
  listProviderReviewsQuerySchema,
} from '../validators/provider.validator.js';
import {
  createProviderProfileHandler,
  getMyProviderProfileHandler,
  updateMyProviderProfileHandler,
  listProvidersHandler,
  getProviderByIdHandler,
  getProviderReviewsHandler,
} from '../controllers/provider.controller.js';

const router = Router();

// Provider profile creation (PROVIDER role only)
router.post(
  '/profile',
  requireAuth,
  requireRole('PROVIDER'),
  validate({ body: createProviderProfileSchema }),
  asyncHandler(createProviderProfileHandler)
);

// Provider's own profile and metrics
router.get(
  '/me',
  requireAuth,
  requireRole('PROVIDER'),
  asyncHandler(getMyProviderProfileHandler)
);

router.patch(
  '/me',
  requireAuth,
  requireRole('PROVIDER'),
  validate({ body: updateProviderProfileSchema }),
  asyncHandler(updateMyProviderProfileHandler)
);

// List active/verified providers (OWNER, ADMIN)
router.get(
  '/',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ query: listProvidersQuerySchema }),
  asyncHandler(listProvidersHandler)
);

// Single provider details (OWNER, ADMIN, or self)
router.get(
  '/:id',
  requireAuth,
  requireRole('OWNER', 'PROVIDER', 'ADMIN'),
  validate({ params: providerIdParamSchema }),
  asyncHandler(getProviderByIdHandler)
);

// Provider reviews
router.get(
  '/:id/reviews',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: providerIdParamSchema, query: listProviderReviewsQuerySchema }),
  asyncHandler(getProviderReviewsHandler)
);

export default router;
