import { Router } from 'express';
import {
  getMyFavorites,
  addFavorite,
  removeFavorite,
} from '../controllers/favorite.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { spaceParamSchema } from '../validators/space.validator.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Customer only (ADMIN allowed)
router.use(requireAuth, requireRole('CUSTOMER', 'ADMIN'));

router.get('/', asyncHandler(getMyFavorites));
router.put('/:spaceId', validate({ params: spaceParamSchema }), asyncHandler(addFavorite));
router.delete('/:spaceId', validate({ params: spaceParamSchema }), asyncHandler(removeFavorite));

export default router;
