import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';

/**
 * @typedef {Object} CalculatePriceInput
 * @property {import('@prisma/client').Prisma.Decimal | number | string} priceAmount - Base price per unit
 * @property {'HOUR' | 'DAY'} priceUnit - Pricing unit ('HOUR' or 'DAY')
 * @property {Date} startAt - Booking start timestamp
 * @property {Date} endAt - Booking end timestamp
 */

/**
 * @typedef {Object} CalculatePriceOutput
 * @property {number} units - Number of chargeable units
 * @property {string} unitLabel - Human-friendly unit label ("hour", "hours", "day", "days")
 * @property {import('@prisma/client').Prisma.Decimal} subtotal - Subtotal amount
 * @property {import('@prisma/client').Prisma.Decimal} taxAmount - Calculated tax amount
 * @property {import('@prisma/client').Prisma.Decimal} totalAmount - Total amount payable by customer
 * @property {import('@prisma/client').Prisma.Decimal} platformFee - Nexora platform commission fee
 * @property {import('@prisma/client').Prisma.Decimal} ownerAmount - Net amount payable to property owner
 */

/**
 * Pure calculation of space pricing, taxes, platform fees, and owner payouts.
 * Uses Prisma.Decimal exclusively to avoid floating-point inaccuracies.
 * All amounts are rounded with ROUND_HALF_UP to 2 decimal places.
 * @param {CalculatePriceInput} input - Booking parameters for price calculation
 * @returns {CalculatePriceOutput} Breakdown of charges, taxes, fees, and payouts
 */
export function calculatePrice(input) {
  const priceAmount =
    input.priceAmount instanceof Prisma.Decimal
      ? input.priceAmount
      : new Prisma.Decimal(input.priceAmount);

  const durationMs = input.endAt.getTime() - input.startAt.getTime();
  if (durationMs <= 0) {
    throw new Error('endAt must be strictly greater than startAt');
  }

  let units = 1;
  let unitLabel = 'hour';

  if (input.priceUnit === 'HOUR') {
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));
    units = Math.max(1, Math.ceil(durationMinutes / 60));
    unitLabel = units === 1 ? 'hour' : 'hours';
  } else if (input.priceUnit === 'DAY') {
    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));
    units = Math.max(1, Math.ceil(durationHours / 24));
    unitLabel = units === 1 ? 'day' : 'days';
  }

  // 1. subtotal = priceAmount * units
  const subtotal = priceAmount
    .mul(units)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  // 2. taxAmount = subtotal * TAX_PERCENT / 100
  const taxPercent = new Prisma.Decimal(env.TAX_PERCENT);
  const taxAmount = subtotal
    .mul(taxPercent)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  // 3. totalAmount = subtotal + taxAmount
  const totalAmount = subtotal
    .add(taxAmount)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  // 4. platformFee = subtotal * PLATFORM_FEE_PERCENT / 100
  const platformFeePercent = new Prisma.Decimal(env.PLATFORM_FEE_PERCENT);
  const platformFee = subtotal
    .mul(platformFeePercent)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  // 5. ownerAmount = subtotal - platformFee (guarantees ownerAmount + platformFee = subtotal)
  const ownerAmount = subtotal
    .sub(platformFee)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return {
    units,
    unitLabel,
    subtotal,
    taxAmount,
    totalAmount,
    platformFee,
    ownerAmount,
  };
}
