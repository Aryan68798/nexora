import { z } from 'zod';

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['OWNER', 'CUSTOMER', 'PROVIDER', 'ADMIN']).optional(),
  isActive: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional()),
  search: z.string().optional(),
});

export const updateUserSchema = z
  .object({
    role: z.enum(['OWNER', 'CUSTOMER', 'PROVIDER', 'ADMIN']).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});
