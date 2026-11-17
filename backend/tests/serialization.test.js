import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { serializeResponse } from '../src/utils/serialize.js';

describe('Response Serialization Utility', () => {
  it('serializes Prisma.Decimal to string with 2 decimal places', () => {
    const decimal = new Prisma.Decimal('120.5');
    const serialized = serializeResponse({ price: decimal });

    expect(serialized.price).toBe('120.50');
  });

  it('serializes zero and large decimals accurately', () => {
    const zeroDecimal = new Prisma.Decimal('0');
    const largeDecimal = new Prisma.Decimal('99999.999');

    expect(serializeResponse(zeroDecimal)).toBe('0.00');
    expect(serializeResponse(largeDecimal)).toBe('100000.00');
  });

  it('serializes Date to ISO string', () => {
    const date = new Date('2026-11-21T12:00:00.000Z');
    const serialized = serializeResponse({ createdAt: date });

    expect(serialized.createdAt).toBe('2026-11-21T12:00:00.000Z');
  });

  it('serializes BigInt to string', () => {
    const big = BigInt(9007199254740991);
    const serialized = serializeResponse({ count: big });

    expect(serialized.count).toBe('9007199254740991');
  });

  it('serializes nested objects and arrays cleanly', () => {
    const data = {
      items: [
        { id: 1, amount: new Prisma.Decimal('45.1') },
        { id: 2, amount: new Prisma.Decimal('90') },
      ],
      created: new Date('2026-01-01T00:00:00.000Z'),
    };

    const serialized = serializeResponse(data);
    expect(serialized.items[0].amount).toBe('45.10');
    expect(serialized.items[1].amount).toBe('90.00');
    expect(serialized.created).toBe('2026-01-01T00:00:00.000Z');
  });
});
