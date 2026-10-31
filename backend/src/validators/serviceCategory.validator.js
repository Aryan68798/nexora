import { z } from 'zod';

export const createCategorySchema = z
  .object({
    name: z.string().min(2, 'Category name must be at least 2 characters').max(100),
    description: z.string().max(500).optional().nullable(),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().min(2, 'Category name must be at least 2 characters').max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const categoryIdParamSchema = z.object({
  id: z.string().uuid('Invalid category ID format'),
});
