import { Router } from 'express';
import { getMe, updateMe, changeRole } from '../controllers/auth.controller.js';
import { uploadAvatar } from '../controllers/media.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateMeSchema, updateRoleSchema } from '../validators/auth.validator.js';
import { handleSingleUpload, uploadMemory2MB } from '../middleware/upload.js';
import { uploadRateLimiter, roleChangeRateLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/me', requireAuth, asyncHandler(getMe));
router.patch('/me', requireAuth, validate({ body: updateMeSchema }), asyncHandler(updateMe));
router.post(
  '/me/role',
  requireAuth,
  roleChangeRateLimiter,
  validate({ body: updateRoleSchema }),
  asyncHandler(changeRole)
);
router.post(
  '/me/avatar',
  requireAuth,
  uploadRateLimiter,
  handleSingleUpload(uploadMemory2MB),
  asyncHandler(uploadAvatar)
);

export default router;
