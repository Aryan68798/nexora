import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Strips non-standard query parameters like ?pgbouncer=true for node-postgres.
 * @param {string} [url] - The database connection URL
 * @returns {string} - Clean connection string
 */
function getCleanConnectionString(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    // Strip ?pgbouncer=true or other non-standard query parameters for node-postgres
    parsed.searchParams.delete('pgbouncer');
    return parsed.toString();
  } catch {
    return url.replace(/([?&])pgbouncer=true(&|$)/, '$1').replace(/[?&]$/, '');
  }
}

const connectionString = getCleanConnectionString(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
