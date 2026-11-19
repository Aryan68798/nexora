import { z } from 'zod';

export const maintenanceIdParamSchema = z
  .object({
    id: z.string().uuid('Invalid maintenance request ID format'),
  })
  .strict();

export const createMaintenanceRequestSchema = z
  .object({
    propertyId: z.string().uuid('Invalid property ID format'),
    spaceId: z.string().uuid('Invalid space ID format').optional().nullable(),
    categoryId: z.string().uuid('Invalid category ID format').optional().nullable(),
    title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters'),
    description: z.string().min(5, 'Description must be at least 5 characters').max(4000, 'Description cannot exceed 4000 characters'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
    estimatedCost: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .refine(
        (val) => {
          if (val === undefined || val === null || val === '') return true;
          const num = Number(val);
          return !isNaN(num) && num >= 0 && num <= 10000000 && /^\d+(\.\d{1,2})?$/.test(String(val));
        },
        { message: 'estimatedCost must be a valid non-negative amount with up to 2 decimal places and <= 10,000,000' }
      ),
    scheduledAt: z
      .string()
      .datetime({ offset: true, message: 'scheduledAt must be an ISO 8601 datetime with timezone offset' })
      .optional()
      .nullable()
      .refine(
        (val) => {
          if (!val) return true;
          return new Date(val).getTime() > Date.now();
        },
        { message: 'scheduledAt must be a future datetime' }
      ),
  })
  .strict();

export const updateMaintenanceRequestSchema = z
  .object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(200).optional(),
    description: z.string().min(5, 'Description must be at least 5 characters').max(4000).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    categoryId: z.string().uuid('Invalid category ID format').optional().nullable(),
    estimatedCost: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .refine(
        (val) => {
          if (val === undefined || val === null || val === '') return true;
          const num = Number(val);
          return !isNaN(num) && num >= 0 && num <= 10000000 && /^\d+(\.\d{1,2})?$/.test(String(val));
        },
        { message: 'estimatedCost must be a valid non-negative amount with up to 2 decimal places and <= 10,000,000' }
      ),
    scheduledAt: z
      .string()
      .datetime({ offset: true, message: 'scheduledAt must be an ISO 8601 datetime with timezone offset' })
      .optional()
      .nullable()
      .refine(
        (val) => {
          if (!val) return true;
          return new Date(val).getTime() > Date.now();
        },
        { message: 'scheduledAt must be a future datetime' }
      ),
  })
  .strict();

export const listMaintenanceQuerySchema = z
  .object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    role: z.enum(['owner', 'provider', 'admin']).optional(),
    status: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    propertyId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    q: z.string().optional(),
    sort: z.enum(['newest', 'priority']).optional(),
  })
  .strict();

export const assignProviderSchema = z
  .object({
    providerId: z.string().uuid('Invalid provider ID format'),
    scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
    estimatedCost: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .refine(
        (val) => {
          if (val === undefined || val === null || val === '') return true;
          const num = Number(val);
          return !isNaN(num) && num >= 0 && num <= 10000000 && /^\d+(\.\d{1,2})?$/.test(String(val));
        },
        { message: 'estimatedCost must be a valid non-negative amount with up to 2 decimal places' }
      ),
  })
  .strict();

export const reasonSchema = z
  .object({
    reason: z.string().min(3, 'Reason must be at least 3 characters').max(500, 'Reason cannot exceed 500 characters'),
  })
  .strict();

export const completeJobSchema = z
  .object({
    actualCost: z
      .union([z.string(), z.number()])
      .refine(
        (val) => {
          const num = Number(val);
          return !isNaN(num) && num >= 0 && /^\d+(\.\d{1,2})?$/.test(String(val));
        },
        { message: 'actualCost must be a valid non-negative number with up to 2 decimal places' }
      ),
    note: z.string().max(1000).optional(),
  })
  .strict();

export const updateNoteSchema = z
  .object({
    note: z.string().min(1, 'Note cannot be empty').max(2000, 'Note cannot exceed 2000 characters'),
  })
  .strict();

export const createProviderReviewSchema = z
  .object({
    rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
    comment: z.string().max(1000, 'Comment cannot exceed 1000 characters').optional().nullable(),
  })
  .strict();
