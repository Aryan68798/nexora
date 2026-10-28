import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mediaIdParamsSchema } from '../validators/inspection.validator.js';
import { deleteInspectionMediaHandler } from '../controllers/inspection.controller.js';

const router = Router();

// Delete inspection media object and database records
router.delete(
  '/:id',
  requireAuth,
  requireRole('OWNER', 'PROVIDER', 'ADMIN'),
  validate({ params: mediaIdParamsSchema }),
  asyncHandler(deleteInspectionMediaHandler)
);

export default router;
