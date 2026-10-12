import { Router } from 'express';
import { getCatalogFilters } from '../controllers/search.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/filters', asyncHandler(getCatalogFilters));

export default router;
