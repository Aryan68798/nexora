import { z } from 'zod';

export const updateMeSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters').optional(),
    phone: z
      .string()
      .regex(/^\+?[0-9]{7,15}$/, 'Phone must be a valid E.164-like phone number (7-15 digits)')
      .optional()
      .nullable(),
    avatarUrl: z
      .string()
      .url('avatarUrl must be a valid URL')
      .regex(/^https:\/\//, 'avatarUrl must be a secure https URL')
      .optional()
      .nullable(),
  })
  .strict();

export const updateRoleSchema = z
  .object({
    role: z.enum(['OWNER', 'PROVIDER'], {
      required_error: 'Role is required',
      invalid_type_error: 'Role must be OWNER or PROVIDER',
    }),
  })
  .strict();
