import { Router } from 'express';
import {
  createProperty,
  getMyProperties,
  getAdminProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
} from '../controllers/property.controller.js';
import { createSpace, getSpacesByProperty } from '../controllers/space.controller.js';
import { uploadPropertyMedia } from '../controllers/media.controller.js';
import {
  createInspectionHandler,
  listPropertyInspectionsHandler,
  getPropertyHealthHandler,
} from '../controllers/inspection.controller.js';
import {
  createPropertyExpenseHandler,
  listPropertyExpensesHandler,
  getPropertyExpensesSummaryHandler,
} from '../controllers/expense.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requireExpenseAccess } from '../middleware/expenseAuth.js';
import { validate } from '../middleware/validate.js';
import { handleSingleUpload, uploadMemory5MB } from '../middleware/upload.js';
import { uploadRateLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createPropertySchema,
  updatePropertySchema,
  propertyIdParamSchema,
  propertyQuerySchema,
} from '../validators/property.validator.js';
import {
  createSpaceSchema,
  propertySpaceParamsSchema,
} from '../validators/space.validator.js';
import {
  createInspectionSchema,
  listPropertyInspectionsQuerySchema,
  propertyInspectionParamsSchema,
} from '../validators/inspection.validator.js';
import {
  propertyExpenseParamsSchema,
  createPropertyExpenseSchema,
  listExpensesQuerySchema,
  expenseSummaryQuerySchema,
} from '../validators/expense.validator.js';

const router = Router();

// Create property (OWNER or ADMIN)
router.post(
  '/',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ body: createPropertySchema }),
  asyncHandler(createProperty)
);

// Get my properties (OWNER or ADMIN)
router.get(
  '/mine',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ query: propertyQuerySchema }),
  asyncHandler(getMyProperties)
);

// Get all properties across platform (ADMIN)
router.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ query: propertyQuerySchema }),
  asyncHandler(getAdminProperties)
);

// Get single property details (Public for ACTIVE; Owner/Admin for non-ACTIVE)
router.get(
  '/:id',
  optionalAuth,
  validate({ params: propertyIdParamSchema }),
  asyncHandler(getPropertyById)
);

// Update property (Owner or ADMIN)
router.patch(
  '/:id',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: propertyIdParamSchema, body: updatePropertySchema }),
  asyncHandler(updateProperty)
);

// Soft delete property (Owner or ADMIN)
router.delete(
  '/:id',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: propertyIdParamSchema }),
  asyncHandler(deleteProperty)
);

// --- Nested Property Space Routes ---
router.post(
  '/:propertyId/spaces',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: propertySpaceParamsSchema, body: createSpaceSchema }),
  asyncHandler(createSpace)
);

router.get(
  '/:propertyId/spaces',
  optionalAuth,
  validate({ params: propertySpaceParamsSchema }),
  asyncHandler(getSpacesByProperty)
);

// --- Nested Property Media Route ---
router.post(
  '/:id/media',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  uploadRateLimiter,
  validate({ params: propertyIdParamSchema }),
  handleSingleUpload(uploadMemory5MB),
  asyncHandler(uploadPropertyMedia)
);

// --- Nested Property Inspection Routes ---
router.post(
  '/:propertyId/inspections',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: propertyInspectionParamsSchema, body: createInspectionSchema }),
  asyncHandler(createInspectionHandler)
);

router.get(
  '/:propertyId/inspections',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: propertyInspectionParamsSchema, query: listPropertyInspectionsQuerySchema }),
  asyncHandler(listPropertyInspectionsHandler)
);

// --- Property Health Route ---
router.get(
  '/:propertyId/health',
  requireAuth,
  requireRole('OWNER', 'ADMIN'),
  validate({ params: propertyInspectionParamsSchema }),
  asyncHandler(getPropertyHealthHandler)
);

// --- Property Expenses Routes ---
router.post(
  '/:propertyId/expenses',
  requireAuth,
  requireExpenseAccess,
  validate({ params: propertyExpenseParamsSchema, body: createPropertyExpenseSchema }),
  asyncHandler(createPropertyExpenseHandler)
);

router.get(
  '/:propertyId/expenses',
  requireAuth,
  requireExpenseAccess,
  validate({ params: propertyExpenseParamsSchema, query: listExpensesQuerySchema }),
  asyncHandler(listPropertyExpensesHandler)
);

router.get(
  '/:propertyId/expenses/summary',
  requireAuth,
  requireExpenseAccess,
  validate({ params: propertyExpenseParamsSchema, query: expenseSummaryQuerySchema }),
  asyncHandler(getPropertyExpensesSummaryHandler)
);

export default router;
