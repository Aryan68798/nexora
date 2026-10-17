import { sendSuccess } from '../utils/response.js';
import { processBookingPayment, getBookingPayments } from '../services/payment.service.js';

export async function createPaymentHandler(req, res) {
  const { id } = req.params;
  const body = req.body;

  const payment = await processBookingPayment({
    bookingId: id,
    callerId: req.user.id,
    method: body.method,
    amount: body.amount,
  });

  sendSuccess(
    res,
    {
      id: payment.id,
      bookingId: payment.booking_id,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.payment_method,
      status: payment.status,
      transactionReference: payment.transaction_reference,
      paidAt: payment.paid_at,
      createdAt: payment.created_at,
    },
    201
  );
}

export async function getPaymentsHandler(req, res) {
  const { id } = req.params;
  const payments = await getBookingPayments(id, req.user);

  const data = payments.map((p) => ({
    id: p.id,
    bookingId: p.booking_id,
    amount: p.amount,
    currency: p.currency,
    paymentMethod: p.payment_method,
    status: p.status,
    transactionReference: p.transaction_reference,
    paidAt: p.paid_at,
    createdAt: p.created_at,
  }));

  sendSuccess(res, data);
}
