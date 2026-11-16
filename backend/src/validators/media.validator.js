import { z } from 'zod';

export const uploadMediaBodySchema = z.object({
  caption: z.string().max(255).optional(),
});

export const updateMediaBodySchema = z
  .object({
    caption: z.string().max(255).optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    isCover: z.boolean().optional(),
  })
  .strict();

export const mediaIdParamSchema = z.object({
  id: z.string().uuid('Invalid media ID format'),
});
