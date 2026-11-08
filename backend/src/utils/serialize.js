import { Prisma } from '@prisma/client';

/**
 * Recursively serializes data for JSON responses:
 * - Converts Prisma.Decimal to "X.XX" fixed 2-decimal string
 * - Converts Date to ISO 8601 string
 * - Converts BigInt to string
 * @param {any} data - Raw data
 * @returns {any} Serialized data safe for JSON transport
 */
export function serializeResponse(data) {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle Prisma Decimal
  if (
    data instanceof Prisma.Decimal ||
    (typeof data === 'object' && typeof data.toFixed === 'function' && ('d' in data || 'isDecimal' in data))
  ) {
    return Number(data).toFixed(2);
  }

  // Handle Date
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle BigInt
  if (typeof data === 'bigint') {
    return data.toString();
  }

  // Handle Array
  if (Array.isArray(data)) {
    return data.map((item) => serializeResponse(item));
  }

  // Handle plain Object
  if (typeof data === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeResponse(value);
    }
    return result;
  }

  return data;
}
