import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getOwnerBookingsHandler } from '../controllers/booking.controller.js';
import { getOwnerHealthOverviewHandler } from '../controllers/inspection.controller.js';
import {
  getOwnerDashboardHandler,
  getOwnerDashboardPropertiesHandler,
  getOwnerDashboardReconcileHandler,
} from '../controllers/dashboard.controller.js';
import { listBookingsQuerySchema } from '../validators/booking.validator.js';
import {
  ownerDashboardQuerySchema,
  ownerDashboardPropertiesQuerySchema,
  ownerDashboardReconcileQuerySchema,
} from '../validators/dashboard.validator.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

function requireOwnerOrAdmin(req, _res, next) {
  if (!req.user) {
    return next(AppError.unauthorized('Authentication required'));
  }
  if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
    return next(AppError.notFound('Not found'));
  }
  next();
}

// Owner Dashboard Endpoints
router.get(
  '/dashboard',
  requireAuth,
  requireOwnerOrAdmin,
  validate({ query: ownerDashboardQuerySchema }),
  asyncHandler(getOwnerDashboardHandler)
);

router.get(
  '/dashboard/properties',
  requireAuth,
  requireOwnerOrAdmin,
  validate({ query: ownerDashboardPropertiesQuerySchema }),
  asyncHandler(getOwnerDashboardPropertiesHandler)
);

router.get(
  '/dashboard/reconcile',
  requireAuth,
  requireOwnerOrAdmin,
  validate({ query: ownerDashboardReconcileQuerySchema }),
  asyncHandler(getOwnerDashboardReconcileHandler)
);

// Owner's property bookings
router.get(
  '/bookings',
  requireAuth,
  requireRole('OWNER'),
  validate({ query: listBookingsQuerySchema }),
  asyncHandler(getOwnerBookingsHandler)
);

// Owner's properties health overview
router.get(
  '/health-overview',
  requireAuth,
  requireRole('OWNER'),
  asyncHandler(getOwnerHealthOverviewHandler)
);

export default router;
