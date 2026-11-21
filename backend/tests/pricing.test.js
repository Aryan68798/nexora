import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { calculatePrice } from '../src/services/pricing.service.js';
import { env } from '../src/config/env.js';

describe('Pricing Service Unit Tests', () => {
  it('calculates hourly pricing correctly and rounds partial hours up', () => {
    const startAt = new Date('2026-12-01T10:00:00Z');
    // 90 minutes = 1.5 hours -> should round up to 2 hours
    const endAt = new Date('2026-12-01T11:30:00Z');

    const result = calculatePrice({
      priceAmount: new Prisma.Decimal('500.00'),
      priceUnit: 'HOUR',
      startAt,
      endAt,
    });

    expect(result.units).toBe(2);
    expect(result.unitLabel).toBe('hours');
    expect(result.subtotal.toString()).toBe('1000');

    // Default TAX is 18%: 1000 * 0.18 = 180
    expect(result.taxAmount.toString()).toBe('180');
    // Total: 1000 + 180 = 1180
    expect(result.totalAmount.toString()).toBe('1180');

    // Default Platform Fee is 10%: 1000 * 0.10 = 100
    expect(result.platformFee.toString()).toBe('100');
    // Owner amount: 1000 - 100 = 900
    expect(result.ownerAmount.toString()).toBe('900');
  });

  it('calculates daily pricing correctly and rounds partial days up', () => {
    const startAt = new Date('2026-12-01T10:00:00Z');
    // 26 hours = 1 day and 2 hours -> should round up to 2 days
    const endAt = new Date('2026-12-02T12:00:00Z');

    const result = calculatePrice({
      priceAmount: new Prisma.Decimal('2500.00'),
      priceUnit: 'DAY',
      startAt,
      endAt,
    });

    expect(result.units).toBe(2);
    expect(result.unitLabel).toBe('days');
    expect(result.subtotal.toString()).toBe('5000');
    expect(result.taxAmount.toString()).toBe('900');
    expect(result.totalAmount.toString()).toBe('5900');
    expect(result.platformFee.toString()).toBe('500');
    expect(result.ownerAmount.toString()).toBe('4500');
  });

  it('enforces all 3 core pricing invariants across various amounts', () => {
    const testCases = [
      { price: '123.45', hours: 3 },
      { price: '999.99', hours: 7 },
      { price: '1.01', hours: 1 },
      { price: '750.50', hours: 5 },
      { price: '12345.67', hours: 12 },
    ];

    const startAt = new Date('2026-12-01T10:00:00Z');

    for (const tc of testCases) {
      const endAt = new Date(startAt.getTime() + tc.hours * 60 * 60 * 1000);
      const res = calculatePrice({
        priceAmount: tc.price,
        priceUnit: 'HOUR',
        startAt,
        endAt,
      });

      // Invariant 1: totalAmount = subtotal + taxAmount
      expect(res.totalAmount.equals(res.subtotal.add(res.taxAmount))).toBe(true);

      // Invariant 2: ownerAmount + platformFee = subtotal
      expect(res.ownerAmount.add(res.platformFee).equals(res.subtotal)).toBe(true);

      // Invariant 3: No negative values
      expect(res.subtotal.gte(0)).toBe(true);
      expect(res.taxAmount.gte(0)).toBe(true);
      expect(res.totalAmount.gte(0)).toBe(true);
      expect(res.platformFee.gte(0)).toBe(true);
      expect(res.ownerAmount.gte(0)).toBe(true);
    }
  });

  it('reads tax and platform fee percentages dynamically from config', () => {
    expect(env.TAX_PERCENT).toBeGreaterThanOrEqual(0);
    expect(env.PLATFORM_FEE_PERCENT).toBeGreaterThanOrEqual(0);

    const startAt = new Date('2026-12-01T10:00:00Z');
    const endAt = new Date('2026-12-01T11:00:00Z');

    const res = calculatePrice({
      priceAmount: '1000.00',
      priceUnit: 'HOUR',
      startAt,
      endAt,
    });

    const expectedTax = new Prisma.Decimal('1000.00')
      .mul(env.TAX_PERCENT)
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const expectedFee = new Prisma.Decimal('1000.00')
      .mul(env.PLATFORM_FEE_PERCENT)
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    expect(res.taxAmount.equals(expectedTax)).toBe(true);
    expect(res.platformFee.equals(expectedFee)).toBe(true);
  });
});
