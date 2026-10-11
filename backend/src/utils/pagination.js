import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * @typedef {Object} PaginationParams
 * @property {number} page - Current page number (1-indexed)
 * @property {number} pageSize - Number of items per page
 * @property {number} skip - Offset for Prisma queries
 * @property {number} take - Limit for Prisma queries
 */

/**
 * @typedef {Object} PaginationMeta
 * @property {number} page - Current page number
 * @property {number} pageSize - Items per page
 * @property {number} total - Total item count
 * @property {number} totalPages - Total number of pages
 */

/**
 * Extracts and calculates pagination parameters from query string.
 * @param {{ page?: number | string, pageSize?: number | string }} query
 * @returns {PaginationParams}
 */
export function getPagination(query) {
  const parsed = paginationQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    skip: (parsed.page - 1) * parsed.pageSize,
    take: parsed.pageSize,
  };
}

/**
 * Builds metadata for paginated responses.
 * @param {number} page - Current page
 * @param {number} pageSize - Page size
 * @param {number} total - Total count
 * @returns {PaginationMeta}
 */
export function buildPaginationMeta(page, pageSize, total) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
