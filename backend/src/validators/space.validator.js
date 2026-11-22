import { z } from 'zod';
import { Prisma } from '@prisma/client';

export const SPACE_TYPES = [
  'ROOM',
  'OFFICE',
  'SHOP',
  'STUDIO',
  'CLASSROOM',
  'PARKING',
  'OTHER',
];

export const PRICE_UNITS = ['HOUR', 'DAY'];
export const SPACE_STATUSES = ['AVAILABLE', 'UNAVAILABLE', 'MAINTENANCE'];

// Safe price validator & transformer
const priceAmountSchema = z
  .union([z.number(), z.string()])
  .refine((val) => {
    const num = Number(val);
    if (isNaN(num) || num <= 0 || num > 10000000) return false;
    // Check max 2 decimal places
    const str = val.toString();
    const parts = str.split('.');
    if (parts.length > 2) return false;
    if (parts.length === 2 && parts[1].length > 2) return false;
    return true;
  }, 'priceAmount must be a positive number with at most 2 decimal places and <= 10,000,000')
  .transform((val) => new Prisma.Decimal(Number(val).toFixed(2)));

export const createSpaceSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(150, 'Name cannot exceed 150 characters'),
    description: z.string().max(2000).optional().nullable(),
    spaceType: z.enum(SPACE_TYPES, {
      errorMap: () => ({ message: `spaceType must be one of: ${SPACE_TYPES.join(', ')}` }),
    }),
    capacity: z.coerce
      .number()
      .int('capacity must be an integer')
      .positive('capacity must be greater than 0')
      .max(100000, 'capacity cannot exceed 100,000'),
    priceAmount: priceAmountSchema,
    priceUnit: z.enum(PRICE_UNITS, {
      errorMap: () => ({ message: `priceUnit must be one of: ${PRICE_UNITS.join(', ')}` }),
    }),
    rules: z.string().max(2000).optional().nullable(),
    status: z.enum(SPACE_STATUSES).optional().default('AVAILABLE'),
  })
  .strict();

export const updateSpaceSchema = z
  .object({
    name: z.string().min(2).max(150).optional(),
    description: z.string().max(2000).optional().nullable(),
    spaceType: z.enum(SPACE_TYPES).optional(),
    capacity: z.coerce.number().int().positive().max(100000).optional(),
    priceAmount: priceAmountSchema.optional(),
    priceUnit: z.enum(PRICE_UNITS).optional(),
    rules: z.string().max(2000).optional().nullable(),
    status: z.enum(SPACE_STATUSES).optional(),
  })
  .strict();

export const spaceIdParamSchema = z.object({
  id: z.string().uuid('Invalid space ID format'),
});

export const spaceParamSchema = z.object({
  spaceId: z.string().uuid('Invalid space ID format'),
});

export const propertySpaceParamsSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID format'),
});
