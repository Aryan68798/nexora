import { z } from 'zod';

export const PROPERTY_TYPES = [
  'APARTMENT',
  'HOUSE',
  'VILLA',
  'COMMERCIAL',
  'OFFICE_BUILDING',
  'HOSTEL',
  'WAREHOUSE',
  'OTHER',
];

export const createPropertySchema = z
  .object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(150, 'Title cannot exceed 150 characters'),
    description: z.string().max(2000).optional().nullable(),
    propertyType: z.enum(PROPERTY_TYPES, {
      errorMap: () => ({ message: `propertyType must be one of: ${PROPERTY_TYPES.join(', ')}` }),
    }),
    addressLine1: z.string().min(1, 'addressLine1 is required').max(255),
    addressLine2: z.string().max(255).optional().nullable(),
    city: z.string().min(1, 'city is required').max(100),
    state: z.string().min(1, 'state is required').max(100),
    postalCode: z.string().min(4, 'postalCode must be at least 4 characters').max(10, 'postalCode cannot exceed 10 characters'),
    country: z.string().max(100).optional().default('India'),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  })
  .strict();

export const updatePropertySchema = z
  .object({
    title: z.string().min(3).max(150).optional(),
    description: z.string().max(2000).optional().nullable(),
    propertyType: z.enum(PROPERTY_TYPES).optional(),
    addressLine1: z.string().min(1).max(255).optional(),
    addressLine2: z.string().max(255).optional().nullable(),
    city: z.string().min(1).max(100).optional(),
    state: z.string().min(1).max(100).optional(),
    postalCode: z.string().min(4).max(10).optional(),
    country: z.string().max(100).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE']).optional(),
  })
  .strict();

export const propertyIdParamSchema = z.object({
  id: z.string().uuid('Invalid property ID format'),
});

export const propertyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE']).optional(),
  city: z.string().optional(),
  search: z.string().optional(),
  ownerId: z.string().uuid().optional(),
});
