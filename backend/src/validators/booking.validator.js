import { z } from 'zod';

export const createBookingBodySchema = z
  .object({
    spaceId: z.string().uuid(),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    guestCount: z.number().int().min(1),
  })
  .strict();

export const quoteBookingBodySchema = createBookingBodySchema;

export const transitionBookingBodySchema = z
  .object({
    status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REJECTED']),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const bookingIdParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REJECTED']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  propertyId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
});

export const spaceAvailabilityQuerySchema = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .refine(
    (data) => {
      const from = new Date(data.from);
      const to = new Date(data.to);
      const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 62;
    },
    { message: 'Date range must be positive and at most 62 days apart' }
  );
