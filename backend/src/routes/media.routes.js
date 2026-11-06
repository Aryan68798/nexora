import { Router } from 'express';
import {
  deletePropertyMedia,
  updatePropertyMedia,
  deleteSpaceMedia,
  updateSpaceMedia,
} from '../controllers/media.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  mediaIdParamSchema,
  updateMediaBodySchema,
} from '../validators/media.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Router for /property-media
export const propertyMediaRouter = Router();
propertyMediaRouter.use(requireAuth, requireRole('OWNER', 'ADMIN'));

propertyMediaRouter.delete(
  '/:id',
  validate({ params: mediaIdParamSchema }),
  asyncHandler(deletePropertyMedia)
);

propertyMediaRouter.patch(
  '/:id',
  validate({ params: mediaIdParamSchema, body: updateMediaBodySchema }),
  asyncHandler(updatePropertyMedia)
);

// Router for /space-media
export const spaceMediaRouter = Router();
spaceMediaRouter.use(requireAuth, requireRole('OWNER', 'ADMIN'));

spaceMediaRouter.delete(
  '/:id',
  validate({ params: mediaIdParamSchema }),
  asyncHandler(deleteSpaceMedia)
);

spaceMediaRouter.patch(
  '/:id',
  validate({ params: mediaIdParamSchema, body: updateMediaBodySchema }),
  asyncHandler(updateSpaceMedia)
);
