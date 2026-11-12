import { z } from 'zod';
import { ALLOWED_PAYMENT_METHODS } from '../services/payment.service.js';

export const createPaymentBodySchema = z
  .object({
    method: z.enum(ALLOWED_PAYMENT_METHODS),
    amount: z.union([z.number(), z.string()]).optional(),
  })
  .strict();
