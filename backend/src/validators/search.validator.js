import { z } from 'zod';
import { SPACE_TYPES, PRICE_UNITS } from './space.validator.js';

export const spaceSearchQuerySchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  spaceType: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const parts = val.split(',').map((p) => p.trim().toUpperCase());
      const valid = parts.filter((p) => SPACE_TYPES.includes(p));
      return valid.length > 0 ? valid : undefined;
    }),
  priceUnit: z.enum(PRICE_UNITS).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minCapacity: z.coerce.number().int().min(1).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const spaceReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
