import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { createNotification } from './notification.service.js';

/**
 * SIMULATED PAYMENT GATEWAY:
 * This service handles mock payment transactions for development and demonstration.
 * In a production deployment, this would be replaced by an integration with a live
 * payment gateway (e.g. Razorpay, Stripe, Cashfree).
 * NO REAL CREDIT CARD OR BANKING CREDENTIALS ARE EVER PROCESSED OR STORED.
 */

export const ALLOWED_PAYMENT_METHODS = [
  'CARD',
  'UPI',
  'NET_BANKING',
  'CASH',
  'WALLET',
];

/**
 * @typedef {'CARD' | 'UPI' | 'NET_BANKING' | 'CASH' | 'WALLET'} PaymentMethod
 */

/**
 * @typedef {Object} CreatePaymentInput
 * @property {string} bookingId - UUID of the confirmed booking
 * @property {string} callerId - UUID of the authenticated customer
 * @property {PaymentMethod} method - Chosen payment method
 * @property {number | string | import('@prisma/client').Prisma.Decimal} [amount] - Optional payment amount
 */

/**
 * Processes a simulated payment for a confirmed booking.
 * Locks booking row FOR UPDATE, verifies remaining balance, inserts payment record,
 * and notifies property owner.
 * @param {CreatePaymentInput} input - Payment input parameters
 * @returns {Promise<any>} The created payment record
 */
export async function processBookingPayment(input) {
  const { bookingId, callerId, method, amount } = input;

  const payment = await prisma.$transaction(async (tx) => {
    // 1. Lock booking row FOR UPDATE
    await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId}::uuid FOR UPDATE`;

    const booking = await tx.bookings.findUnique({
      where: { id: bookingId },
      include: {
        spaces: {
          include: {
            properties: true,
          },
        },
        payments: true,
      },
    });

    if (!booking) {
      throw new AppError(404, 'NOT_FOUND', 'Booking not found');
    }

    if (booking.customer_id !== callerId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the customer who booked can make payments');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new AppError(
        409,
        'BOOKING_NOT_CONFIRMED',
        `Payments are only accepted for CONFIRMED bookings (current status: ${booking.status})`
      );
    }

    // 2. Sum existing PAID payments
    const paidPayments = booking.payments.filter((p) => p.status === 'PAID');
    const existingPaid = paidPayments.reduce(
      (sum, p) => sum.add(p.amount),
      new Prisma.Decimal(0)
    );
    const remainingBalance = booking.total_amount.sub(existingPaid);

    let paymentAmount;
    if (amount === undefined || amount === null) {
      paymentAmount = remainingBalance;
    } else {
      paymentAmount =
        amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
    }

    if (paymentAmount.lte(0)) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Payment amount must be greater than zero');
    }

    if (paymentAmount.decimalPlaces() > 2) {
      throw new AppError(
        400,
        'INVALID_AMOUNT',
        'Payment amount cannot exceed 2 decimal places'
      );
    }

    if (existingPaid.add(paymentAmount).gt(booking.total_amount)) {
      throw new AppError(
        400,
        'OVERPAYMENT',
        `Payment amount (₹${paymentAmount.toFixed(2)}) exceeds remaining balance (₹${remainingBalance.toFixed(2)})`
      );
    }

    // 3. Insert payment record
    const reference = `SIM-${randomUUID()}`;
    const newPayment = await tx.payments.create({
      data: {
        booking_id: booking.id,
        payer_id: callerId,
        amount: paymentAmount,
        currency: 'INR',
        payment_method: method,
        status: 'PAID',
        transaction_reference: reference,
        paid_at: new Date(),
      },
    });

    return {
      payment: newPayment,
      booking,
      paymentAmount,
    };
  });

  // Post-commit notification to space owner
  createNotification({
    userId: payment.booking.spaces.properties.owner_id,
    type: 'PAYMENT_RECEIVED',
    title: 'Payment Received',
    message: `Payment of ₹${payment.paymentAmount.toFixed(2)} received for ${payment.booking.spaces.name}`,
    linkUrl: `/owner/bookings?id=${payment.booking.id}`,
  });

  return payment.payment;
}

/**
 * Retrieves all payments for a booking with strict visibility checks.
 * @param {string} bookingId - Booking UUID
 * @param {{ id: string, role: string }} caller - Authenticated user details
 * @returns {Promise<any[]>} List of payment records
 */
export async function getBookingPayments(bookingId, caller) {
  const booking = await prisma.bookings.findUnique({
    where: { id: bookingId },
    include: {
      spaces: {
        include: {
          properties: true,
        },
      },
    },
  });

  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }

  const isCustomer = caller.id === booking.customer_id;
  const isOwner = caller.id === booking.spaces.properties.owner_id;
  const isAdmin = caller.role === 'ADMIN';

  if (!isCustomer && !isOwner && !isAdmin) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }

  return prisma.payments.findMany({
    where: { booking_id: bookingId },
    orderBy: { created_at: 'desc' },
  });
}
