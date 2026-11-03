import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),
  TEST_USER_EMAIL: z.string().email().optional(),
  TEST_USER_PASSWORD: z.string().optional(),
  TEST_OWNER_EMAIL: z.string().email().optional(),
  TEST_OWNER_PASSWORD: z.string().optional(),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  TAX_PERCENT: z.coerce.number().min(0).max(100).default(18),
  MIN_BOOKING_LEAD_MINUTES: z.coerce.number().positive().default(30),
  FREE_CANCELLATION_HOURS: z.coerce.number().positive().default(24),
  MAX_BOOKING_DAYS: z.coerce.number().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missingKeys = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  console.error(`[FATAL] Configuration error: Missing or invalid environment variable(s): ${missingKeys}`);
  process.exit(1);
}

const origins = parsed.data.FRONTEND_URL.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  ...parsed.data,
  ALLOWED_ORIGINS: origins.length > 0 ? origins : ['http://localhost:3000'],
};
