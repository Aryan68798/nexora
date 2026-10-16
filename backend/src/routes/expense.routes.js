import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireExpenseAccess } from '../middleware/expenseAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { handleReceiptUpload, uploadMemory5MB } from '../middleware/upload.js';
import { uploadRateLimiter } from '../middleware/rateLimit.js';
import {
  expenseIdParamSchema,
  updateExpenseSchema,
} from '../validators/expense.validator.js';
import {
  getExpenseCategoriesHandler,
  getExpenseByIdHandler,
  updateExpenseHandler,
  deleteExpenseHandler,
  uploadExpenseReceiptHandler,
  deleteExpenseReceiptHandler,
} from '../controllers/expense.controller.js';

const router = Router();

// GET /api/expenses/categories
router.get(
  '/categories',
  requireAuth,
  requireExpenseAccess,
  asyncHandler(getExpenseCategoriesHandler)
);

// GET /api/expenses/:id
router.get(
  '/:id',
  requireAuth,
  requireExpenseAccess,
  validate({ params: expenseIdParamSchema }),
  asyncHandler(getExpenseByIdHandler)
);

// PATCH /api/expenses/:id
router.patch(
  '/:id',
  requireAuth,
  requireExpenseAccess,
  validate({ params: expenseIdParamSchema, body: updateExpenseSchema }),
  asyncHandler(updateExpenseHandler)
);

// DELETE /api/expenses/:id
router.delete(
  '/:id',
  requireAuth,
  requireExpenseAccess,
  validate({ params: expenseIdParamSchema }),
  asyncHandler(deleteExpenseHandler)
);

// POST /api/expenses/:id/receipt
router.post(
  '/:id/receipt',
  requireAuth,
  requireExpenseAccess,
  validate({ params: expenseIdParamSchema }),
  uploadRateLimiter,
  handleReceiptUpload(uploadMemory5MB),
  asyncHandler(uploadExpenseReceiptHandler)
);

// DELETE /api/expenses/:id/receipt
router.delete(
  '/:id/receipt',
  requireAuth,
  requireExpenseAccess,
  validate({ params: expenseIdParamSchema }),
  asyncHandler(deleteExpenseReceiptHandler)
);

export default router;
