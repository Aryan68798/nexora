import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { handleSingleUpload, uploadMemory5MB } from '../middleware/upload.js';
import { uploadRateLimiter } from '../middleware/rateLimit.js';
import {
  inspectionIdParamsSchema,
  updateInspectionSchema,
  updateItemsSchema,
  completeInspectionSchema,
  uploadInspectionMediaSchema,
} from '../validators/inspection.validator.js';
import {
  getInspectionTemplatesHandler,
  getInspectionByIdHandler,
  updateInspectionHandler,
  updateInspectionItemsHandler,
  completeInspectionHandler,
  cancelInspectionHandler,
  uploadInspectionMediaHandler,
} from '../controllers/inspection.controller.js';

const router = Router();

// 1. Static Checklist Template (Placed before :id route)
router.get(
  '/templates',
  requireAuth,
  requireRole('OWNER', 'PROVIDER', 'ADMIN'),
  asyncHandler(getInspectionTemplatesHandler)
);

// 2. Get Inspection Details with Items, Media, and Score
router.get(
  '/:id',
  requireAuth,
  requireRole('OWNER', 'PROVIDER', 'ADMIN'),
  validate({ params: inspectionIdParamsSchema }),
  asyncHandler(getInspectionByIdHandler)
);

// 3. Patch Inspection Schedule or Summary (while SCHEDULED)
router.patch(
  '/:id',
  requireAuth,
  requireRole('OWNER', 'PROVIDER', 'ADMIN'),
  validate({ params: inspectionIdParamsSchema, body: updateInspectionSchema }),
  asyncHandler(updateInspectionHandler)
);

// 4. Replace Entire Checklist (while SCHEDULED or IN_PROGRESS)
router.put(
  '/:id/items',
  requireAuth,
  requireRole('OWNER', 'PROVIDER', 'ADMIN'),
  validate({ params: inspectionIdParamsSchema, body: updateItemsSchema }),
  asyncHandler(updateInspectionItemsHandler)
);

// 5. Complete Inspection & Deterministically Compute Health Score
router.post(
  '/:id/complete',
  requireAuth,
  requireRole('OWNER', 'PROVIDER', 'ADMIN'),
  validate({ params: inspectionIdParamsSchema, body: completeInspectionSchema }),
  asyncHandler(completeInspectionHandler)
);

// 6. Cancel Inspection (Owner or ADMIN only, before COMPLETED)
router.post(
  '/:id/cancel',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: inspectionIdParamsSchema }),
  asyncHandler(cancelInspectionHandler)
);

// 7. Upload Inspection Media (Private bucket, 5MB limit)
router.post(
  '/:id/media',
  requireAuth,
  requireRole('OWNER', 'PROVIDER', 'ADMIN'),
  uploadRateLimiter,
  validate({ params: inspectionIdParamsSchema }),
  handleSingleUpload(uploadMemory5MB),
  validate({ body: uploadInspectionMediaSchema }),
  asyncHandler(uploadInspectionMediaHandler)
);

export default router;
