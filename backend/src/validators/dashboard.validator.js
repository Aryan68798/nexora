import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const ownerDashboardQuerySchema = z
  .object({
    from: z.string().regex(dateRegex, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(dateRegex, 'to must be YYYY-MM-DD').optional(),
    propertyId: z.string().uuid('Invalid propertyId').optional(),
  })
  .strict();

export const ownerDashboardPropertiesQuerySchema = z
  .object({
    from: z.string().regex(dateRegex, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(dateRegex, 'to must be YYYY-MM-DD').optional(),
  })
  .strict();

export const ownerDashboardReconcileQuerySchema = z
  .object({
    from: z.string().regex(dateRegex, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(dateRegex, 'to must be YYYY-MM-DD').optional(),
    propertyId: z.string().uuid('Invalid propertyId').optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  })
  .strict();

export const adminDashboardQuerySchema = z
  .object({
    from: z.string().regex(dateRegex, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(dateRegex, 'to must be YYYY-MM-DD').optional(),
  })
  .strict();
