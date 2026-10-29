import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unread: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),
});

export const notificationIdParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();
