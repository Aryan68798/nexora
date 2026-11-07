import { z } from 'zod';

export const providerIdParamSchema = z
  .object({
    id: z.string().uuid('Invalid provider ID format'),
  })
  .strict();

export const createProviderProfileSchema = z
  .object({
    businessName: z.string().min(2, 'Business name must be at least 2 characters').max(150, 'Business name cannot exceed 150 characters'),
    bio: z.string().max(2000, 'Bio cannot exceed 2000 characters').optional().nullable(),
    serviceAreaCity: z.string().min(1, 'City is required').max(100),
    serviceAreaState: z.string().min(1, 'State is required').max(100),
    categoryIds: z
      .array(z.string().uuid('Invalid category ID format'))
      .min(1, 'At least 1 category is required')
      .max(10, 'Maximum 10 categories allowed'),
  })
  .strict();

export const updateProviderProfileSchema = z
  .object({
    businessName: z.string().min(2, 'Business name must be at least 2 characters').max(150).optional(),
    bio: z.string().max(2000).optional().nullable(),
    serviceAreaCity: z.string().min(1).max(100).optional(),
    serviceAreaState: z.string().min(1).max(100).optional(),
    isAvailable: z.boolean().optional(),
    categoryIds: z
      .array(z.string().uuid('Invalid category ID format'))
      .min(1, 'At least 1 category is required')
      .max(10, 'Maximum 10 categories allowed')
      .optional(),
  })
  .strict();

export const listProvidersQuerySchema = z
  .object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    categoryId: z.string().uuid('Invalid category ID format').optional(),
    city: z.string().optional(),
    q: z.string().optional(),
  })
  .strict();

export const adminListProvidersQuerySchema = z
  .object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
  })
  .strict();

export const adminUpdateVerificationSchema = z
  .object({
    status: z.enum(['VERIFIED', 'REJECTED', 'PENDING'], {
      errorMap: () => ({ message: 'status must be VERIFIED, REJECTED, or PENDING' }),
    }),
    note: z.string().max(1000).optional(),
  })
  .strict();

export const listProviderReviewsQuerySchema = z
  .object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  })
  .strict();
