import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  'MAINTENANCE',
  'UTILITIES',
  'TAXES',
  'INSURANCE',
  'CLEANING',
  'SUPPLIES',
  'SALARY',
  'OTHER',
];

const amountSchema = z
  .union([z.number(), z.string()])
  .refine(
    (val) => {
      const str = String(val).trim();
      if (!/^\d+(\.\d{1,2})?$/.test(str)) return false;
      const num = Number(str);
      return !isNaN(num) && num > 0 && num <= 100000000;
    },
    { message: 'amount must be a valid positive number greater than 0, with up to 2 decimal places and <= 100,000,000' }
  );

const incurredOnSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'incurredOn must be a valid date in YYYY-MM-DD format')
  .refine(
    (val) => {
      const d = new Date(val + 'T00:00:00.000Z');
      if (isNaN(d.getTime())) return false;
      const minDate = new Date('2000-01-01T00:00:00.000Z');
      const now = new Date();
      // Allow through end of today
      const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      return d >= minDate && d <= todayEnd;
    },
    { message: 'incurredOn cannot be in the future and cannot be before 2000-01-01' }
  );

export const expenseIdParamSchema = z
  .object({
    id: z.string().uuid('Invalid expense ID format'),
  })
  .strict();

export const propertyExpenseParamsSchema = z
  .object({
    propertyId: z.string().uuid('Invalid property ID format'),
  })
  .strict();

export const propertyIdParamSchema = propertyExpenseParamsSchema;

export const createPropertyExpenseSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES, {
      errorMap: () => ({ message: `category must be one of: ${EXPENSE_CATEGORIES.join(', ')}` }),
    }),
    description: z
      .string()
      .min(3, 'Description must be at least 3 characters')
      .max(1000, 'Description cannot exceed 1000 characters'),
    amount: amountSchema,
    incurredOn: incurredOnSchema,
    maintenanceRequestId: z.string().uuid('Invalid maintenance request ID format').optional().nullable(),
  })
  .strict();

export const updateExpenseSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    description: z
      .string()
      .min(3, 'Description must be at least 3 characters')
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional(),
    amount: amountSchema.optional(),
    incurredOn: incurredOnSchema.optional(),
  })
  .strict();

export const recordExpenseFromJobSchema = z
  .object({
    description: z
      .string()
      .min(3, 'Description must be at least 3 characters')
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional(),
    incurredOn: incurredOnSchema.optional(),
  })
  .strict();

export const listExpensesQuerySchema = z
  .object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    category: z.string().optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
    q: z.string().optional(),
    sort: z.enum(['newest', 'amount_desc']).optional(),
  })
  .strict();

export const expenseSummaryQuerySchema = z
  .object({
    year: z.string().regex(/^\d{4}$/, 'year must be YYYY format').optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
  })
  .strict();
