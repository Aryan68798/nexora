import { Router } from 'express';
import { getAdminUsers, updateAdminUser, getAdminStats } from '../controllers/admin.controller.js';
import { getAdminDashboardHandler } from '../controllers/dashboard.controller.js';
import {
  adminListProvidersHandler,
  adminUpdateVerificationHandler,
} from '../controllers/provider.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  adminUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
} from '../validators/admin.validator.js';
import {
  adminListProvidersQuerySchema,
  adminUpdateVerificationSchema,
  providerIdParamSchema,
} from '../validators/provider.validator.js';
import { adminDashboardQuerySchema } from '../validators/dashboard.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/dashboard', validate({ query: adminDashboardQuerySchema }), asyncHandler(getAdminDashboardHandler));
router.get('/users', validate({ query: adminUsersQuerySchema }), asyncHandler(getAdminUsers));
router.patch(
  '/users/:id',
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  asyncHandler(updateAdminUser)
);
router.get('/stats', asyncHandler(getAdminStats));

// Provider Management (ADMIN)
router.get(
  '/providers',
  validate({ query: adminListProvidersQuerySchema }),
  asyncHandler(adminListProvidersHandler)
);

router.patch(
  '/providers/:id/verification',
  validate({ params: providerIdParamSchema, body: adminUpdateVerificationSchema }),
  asyncHandler(adminUpdateVerificationHandler)
);

export default router;
