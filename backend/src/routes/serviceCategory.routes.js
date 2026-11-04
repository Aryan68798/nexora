import { Router } from 'express';
import { getCategories, createCategory, updateCategory } from '../controllers/serviceCategory.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
} from '../validators/serviceCategory.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(getCategories));

router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createCategorySchema }),
  asyncHandler(createCategory)
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: categoryIdParamSchema, body: updateCategorySchema }),
  asyncHandler(updateCategory)
);

export default router;
