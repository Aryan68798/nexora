import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requireExpenseAccess } from '../middleware/expenseAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { handleOptionalUpload, uploadMemory5MB } from '../middleware/upload.js';
import { uploadRateLimiter } from '../middleware/rateLimit.js';
import {
  maintenanceIdParamSchema,
  createMaintenanceRequestSchema,
  updateMaintenanceRequestSchema,
  listMaintenanceQuerySchema,
  assignProviderSchema,
  reasonSchema,
  completeJobSchema,
  updateNoteSchema,
  createProviderReviewSchema,
} from '../validators/maintenance.validator.js';
import { recordExpenseFromJobSchema } from '../validators/expense.validator.js';
import {
  createMaintenanceRequestHandler,
  listMaintenanceRequestsHandler,
  getMaintenanceRequestByIdHandler,
  updateMaintenanceRequestHandler,
  assignProviderHandler,
  unassignProviderHandler,
  declineJobHandler,
  startJobHandler,
  completeJobHandler,
  cancelJobHandler,
  addUpdateRequestHandler,
  createProviderReviewHandler,
} from '../controllers/maintenance.controller.js';
import { recordExpenseFromJobHandler } from '../controllers/expense.controller.js';

const router = Router();

// Create maintenance request (OWNER of property or ADMIN)
router.post(
  '/',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ body: createMaintenanceRequestSchema }),
  asyncHandler(createMaintenanceRequestHandler)
);

// List maintenance requests with role-based visibility
router.get(
  '/',
  requireAuth,
  requireRole('OWNER', 'PROVIDER', 'ADMIN'),
  validate({ query: listMaintenanceQuerySchema }),
  asyncHandler(listMaintenanceRequestsHandler)
);

// Detail endpoint with allowedActions and counterpart contact
router.get(
  '/:id',
  requireAuth,
  validate({ params: maintenanceIdParamSchema }),
  asyncHandler(getMaintenanceRequestByIdHandler)
);

// Update request while in OPEN or ASSIGNED
router.patch(
  '/:id',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: maintenanceIdParamSchema, body: updateMaintenanceRequestSchema }),
  asyncHandler(updateMaintenanceRequestHandler)
);

// Job Workflow Transitions
router.post(
  '/:id/assign',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: maintenanceIdParamSchema, body: assignProviderSchema }),
  asyncHandler(assignProviderHandler)
);

router.post(
  '/:id/unassign',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: maintenanceIdParamSchema }),
  asyncHandler(unassignProviderHandler)
);

router.post(
  '/:id/decline',
  requireAuth,
  requireRole('PROVIDER'),
  validate({ params: maintenanceIdParamSchema, body: reasonSchema }),
  asyncHandler(declineJobHandler)
);

router.post(
  '/:id/start',
  requireAuth,
  requireRole('PROVIDER', 'ADMIN'),
  validate({ params: maintenanceIdParamSchema }),
  asyncHandler(startJobHandler)
);

router.post(
  '/:id/complete',
  requireAuth,
  requireRole('OWNER', 'PROVIDER', 'ADMIN'),
  validate({ params: maintenanceIdParamSchema, body: completeJobSchema }),
  asyncHandler(completeJobHandler)
);

router.post(
  '/:id/cancel',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: maintenanceIdParamSchema, body: reasonSchema }),
  asyncHandler(cancelJobHandler)
);

// Update note with optional photo
router.post(
  '/:id/updates',
  requireAuth,
  requireRole('OWNER', 'PROVIDER', 'ADMIN'),
  uploadRateLimiter,
  validate({ params: maintenanceIdParamSchema }),
  handleOptionalUpload(uploadMemory5MB),
  validate({ body: updateNoteSchema }),
  asyncHandler(addUpdateRequestHandler)
);

// Provider review (OWNER only, COMPLETED requests)
router.post(
  '/:id/review',
  requireAuth,
  requireRole('OWNER'),
  validate({ params: maintenanceIdParamSchema, body: createProviderReviewSchema }),
  asyncHandler(createProviderReviewHandler)
);

// Record expense from completed maintenance job (OWNER of property or ADMIN)
router.post(
  '/:id/expense',
  requireAuth,
  requireExpenseAccess,
  validate({ params: maintenanceIdParamSchema, body: recordExpenseFromJobSchema }),
  asyncHandler(recordExpenseFromJobHandler)
);

export default router;
