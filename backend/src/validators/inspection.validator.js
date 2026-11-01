import { z } from 'zod';

export const propertyInspectionParamsSchema = z
  .object({
    propertyId: z.string().uuid({ message: 'Invalid property ID format' }),
  })
  .strict();

export const inspectionIdParamsSchema = z
  .object({
    id: z.string().uuid({ message: 'Invalid inspection ID format' }),
  })
  .strict();

export const mediaIdParamsSchema = z
  .object({
    id: z.string().uuid({ message: 'Invalid media ID format' }),
  })
  .strict();

export const createInspectionSchema = z
  .object({
    scheduledAt: z.string().datetime({ offset: true, message: 'scheduledAt must be an ISO 8601 datetime with timezone offset' }),
    inspectorId: z.string().uuid({ message: 'inspectorId must be a valid UUID' }).optional(),
    summary: z.string().max(1000, { message: 'summary must not exceed 1000 characters' }).optional(),
  })
  .strict();

export const updateInspectionSchema = z
  .object({
    scheduledAt: z.string().datetime({ offset: true, message: 'scheduledAt must be an ISO 8601 datetime with timezone offset' }).optional(),
    summary: z.string().max(1000, { message: 'summary must not exceed 1000 characters' }).optional(),
  })
  .strict();

export const checklistItemSchema = z
  .object({
    itemName: z.string().min(1, 'itemName cannot be empty').max(150, 'itemName cannot exceed 150 characters'),
    category: z.string().min(1, 'category cannot be empty').max(100, 'category cannot exceed 100 characters'),
    condition: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'], {
      errorMap: () => ({ message: 'condition must be EXCELLENT, GOOD, FAIR, POOR, or CRITICAL' }),
    }),
    notes: z.string().max(1000, 'notes cannot exceed 1000 characters').optional().nullable(),
  })
  .strict();

export const updateItemsSchema = z
  .object({
    items: z.array(checklistItemSchema).min(1, 'At least 1 item is required').max(100, 'Maximum 100 items allowed'),
  })
  .strict();

export const completeInspectionSchema = z
  .object({})
  .strict({ message: 'Body must be empty. Score and status are strictly managed by the server.' });

export const listPropertyInspectionsQuerySchema = z
  .object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict();

export const uploadInspectionMediaSchema = z
  .object({
    caption: z.string().max(255, 'caption cannot exceed 255 characters').optional(),
  })
  .strict();
