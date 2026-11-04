import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getNotificationsHandler,
  getUnreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
} from '../controllers/notification.controller.js';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from '../validators/notification.validator.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  validate({ query: listNotificationsQuerySchema }),
  asyncHandler(getNotificationsHandler)
);

router.get('/unread-count', asyncHandler(getUnreadCountHandler));

router.patch(
  '/:id/read',
  validate({ params: notificationIdParamSchema }),
  asyncHandler(markAsReadHandler)
);

router.post('/read-all', asyncHandler(markAllAsReadHandler));

export default router;
