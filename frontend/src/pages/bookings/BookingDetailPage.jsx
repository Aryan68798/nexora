import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  Users,
  MapPin,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Building,
  Sparkles,
  DollarSign,
  QrCode,
  Wallet,
  Receipt,
  Star,
} from 'lucide-react';
import { differenceInHours } from 'date-fns';
import { api, ApiError } from '../../api/client';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Rating } from '../../components/ui/Rating';
import { BottomSheet } from '../../components/native/BottomSheet';
import { EdgeSwipeBack } from '../../components/native/EdgeSwipeBack';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import {
  formatINR,
  formatKolkataDate,
  formatKolkataTime,
  formatKolkata,
  cn,
} from '../../lib/utils';

const PAYMENT_METHODS = [
  { id: 'UPI', label: 'UPI / QR', description: 'Instant UPI app transfer or QR scan', icon: QrCode },
  { id: 'CARD', label: 'Credit / Debit Card', description: 'Simulated card transaction (no real card collected)', icon: CreditCard },
  { id: 'NET_BANKING', label: 'Net Banking', description: 'Direct simulated transfer from major banks', icon: Building },
  { id: 'WALLET', label: 'Digital Wallet', description: 'Simulated payment from digital balance', icon: Wallet },
  { id: 'CASH', label: 'Cash on Arrival', description: 'Direct settlement during physical check-in', icon: DollarSign },
];

/**
 * Visual Status Timeline component
 */
function StatusTimeline({ history = [] }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs">
      <h3 className="font-editorial text-xl font-normal text-ink mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        <span>Reservation Timeline</span>
      </h3>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {history.map((event, idx) => (
          <div key={event.id || idx} className="relative group">
            {/* Timeline bullet */}
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-primary bg-card flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            </div>

            <div>
              <div className="flex flex-wrap items-baseline gap-2 mb-1">
                <span className="font-semibold text-sm text-ink">{event.status}</span>
                <span className="text-xs text-body">&bull;</span>
                <span className="text-xs text-body font-medium">{event.changedBy}</span>
                <span className="text-2xs text-body/70 ml-auto">
                  {formatKolkata(event.changedAt, 'dd MMM yyyy, hh:mm a')}
                </span>
              </div>
              {event.note && (
                <p className="text-xs text-body bg-sand/60 p-2.5 rounded-xl border border-border/50 mt-1">
                  {event.note}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Payment Panel for CONFIRMED bookings with remaining balance
 */
function PaymentPanel({ booking, balance, onSuccess }) {
  const [selectedMethod, setSelectedMethod] = useState('UPI');
  const [amountInput, setAmountInput] = useState(balance.toFixed(2));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  const parsedAmount = parseFloat(amountInput);
  const isOverpayment = !isNaN(parsedAmount) && parsedAmount > balance + 0.001;
  const isInvalidAmount = isNaN(parsedAmount) || parsedAmount <= 0;

  const handleAmountChange = (e) => {
    setAmountInput(e.target.value);
    setPaymentError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isOverpayment) {
      setPaymentError(`Payment amount cannot exceed remaining balance of ${formatINR(balance)}.`);
      return;
    }
    if (isInvalidAmount) {
      setPaymentError('Please enter a valid amount greater than ₹0.00.');
      return;
    }

    setIsSubmitting(true);
    setPaymentError(null);

    try {
      const response = await api.post(`/api/bookings/${booking.id}/payments`, {
        method: selectedMethod,
        amount: parseFloat(parsedAmount.toFixed(2)),
      });

      setPaymentSuccess(response);
      onSuccess?.();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'OVERPAYMENT') {
          setPaymentError('The submitted amount exceeds the remaining balance.');
        } else if (err.code === 'INVALID_TRANSITION' || err.code === 'BOOKING_NOT_CONFIRMED') {
          setPaymentError('Payment cannot be processed in the current booking status.');
        } else {
          setPaymentError(err.message || 'Payment failed. Please try again.');
        }
      } else {
        setPaymentError(err.message || 'Failed to process payment.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-success/40 shadow-warm-sm">
        <div className="flex items-center gap-3 text-success mb-3">
          <CheckCircle2 className="w-6 h-6" />
          <h3 className="font-editorial text-2xl font-normal text-ink">Payment Successful</h3>
        </div>
        <p className="text-body text-sm mb-4">
          Thank you! Your payment of <strong>{formatINR(paymentSuccess.amount)}</strong> has been recorded.
        </p>
        <div className="bg-sand p-3.5 rounded-2xl border border-border text-xs text-body space-y-1">
          <p>
            <span className="font-medium text-ink">Reference:</span> {paymentSuccess.transactionReference}
          </p>
          <p>
            <span className="font-medium text-ink">Method:</span> {paymentSuccess.paymentMethod}
          </p>
          <p>
            <span className="font-medium text-ink">Settled at:</span> {formatKolkata(paymentSuccess.paidAt)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs space-y-6">
      <div>
        <h3 className="font-editorial text-2xl font-normal text-ink mb-1">Settle Balance</h3>
        <p className="text-xs text-body">
          Remaining balance due: <strong className="text-primary font-semibold">{formatINR(balance)}</strong>
        </p>
      </div>

      {/* Mandatory Demo Banner */}
      <div
        className="p-3.5 rounded-2xl bg-amber/10 border border-amber/30 text-ink text-xs flex items-start gap-2.5"
        role="alert"
      >
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Demo payment:</strong> no real money moves and no card details are collected.
        </span>
      </div>

      {paymentError && (
        <div className="p-3.5 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{paymentError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Method Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-body block mb-3">
            Select Payment Method
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedMethod(method.id)}
                  className={cn(
                    'flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all focus-ring',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-warm-xs'
                      : 'border-border bg-card hover:bg-sand/60'
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      isSelected ? 'bg-primary text-white' : 'bg-sand text-body'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink truncate">{method.label}</p>
                    <p className="text-2xs text-body truncate">{method.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-body block mb-1.5">
            Payment Amount (INR)
          </label>
          <div className="relative rounded-2xl border border-border bg-card overflow-hidden focus-within:border-primary">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-serif text-ink text-sm">₹</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={balance.toFixed(2)}
              value={amountInput}
              onChange={handleAmountChange}
              className="w-full pl-8 pr-4 py-2.5 bg-transparent text-ink text-sm font-semibold focus:outline-none"
              placeholder="0.00"
            />
          </div>
          {isOverpayment && (
            <p className="text-xs text-danger mt-1">
              Amount cannot exceed the remaining balance of {formatINR(balance)}.
            </p>
          )}
          <div className="flex items-center justify-between text-2xs text-body mt-1.5">
            <span>Minimum partial payment: ₹1.00</span>
            <button
              type="button"
              onClick={() => setAmountInput(balance.toFixed(2))}
              className="text-primary hover:underline font-semibold"
            >
              Pay full balance ({formatINR(balance)})
            </button>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full justify-center shadow-warm-xs"
          loading={isSubmitting}
          disabled={isOverpayment || isInvalidAmount}
        >
          Pay {formatINR(parsedAmount || 0)}
        </Button>
      </form>
    </div>
  );
}

/**
 * Cancellation Modal with 24h refund policy notice
 */
function CancellationModal({ isOpen, onClose, booking, onConfirmCancel }) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!booking) return null;

  const now = new Date();
  const startAt = new Date(booking.startAt);
  const hoursUntilStart = differenceInHours(startAt, now);
  const isEligibleForRefund = hoursUntilStart >= 24;

  const handleCancelSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmCancel(reason);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel Reservation"
    >
      <div className="space-y-4">
        {/* Refund Policy Explainer Box */}
        <div
          className={cn(
            'p-4 rounded-2xl border text-xs leading-relaxed space-y-2',
            isEligibleForRefund ? 'bg-success/10 border-success/30' : 'bg-warning/15 border-warning/40'
          )}
        >
          <div className="flex items-center gap-2 font-semibold">
            {isEligibleForRefund ? (
              <>
                <ShieldCheck className="w-4 h-4 text-success" />
                <span className="text-success-800">Full Refund Eligible</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-warning-800" />
                <span className="text-warning-800">Non-Refundable Window</span>
              </>
            )}
          </div>
          <p className="text-ink">
            {isEligibleForRefund
              ? `Check-in begins in ${hoursUntilStart} hours. Because you are cancelling at least 24 hours prior to check-in, any paid amount will be refunded in full.`
              : `Check-in begins in ${Math.max(0, hoursUntilStart)} hours. Cancellations within 24 hours of check-in are strictly non-refundable per our guest stewardship policy.`}
          </p>
          <p className="text-2xs text-body italic">
            * The server verifies the exact timestamp and computes the finalized refund amount.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-body block mb-1.5">
            Cancellation Reason (Optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Tell us why you are cancelling..."
            className="w-full p-3 rounded-2xl border border-border bg-sand/30 text-ink text-xs focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Keep Reservation
          </Button>
          <Button
            variant="danger"
            onClick={handleCancelSubmit}
            loading={isSubmitting}
          >
            Confirm Cancellation
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

/**
 * Review Panel for COMPLETED bookings
 */
function ReviewPanel({ booking, existingReview, onReviewCreated }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  if (existingReview) {
    return (
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs">
        <h3 className="font-editorial text-xl font-normal text-ink mb-3 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber fill-amber" />
          <span>Your Review</span>
        </h3>
        <div className="flex items-center gap-2 mb-2">
          <Rating value={existingReview.rating} readonly size="sm" />
          <span className="text-xs text-body font-medium">
            {formatKolkata(existingReview.createdAt, 'dd MMM yyyy')}
          </span>
        </div>
        {existingReview.comment && (
          <p className="text-sm text-body leading-relaxed bg-sand/40 p-4 rounded-2xl border border-border/60">
            &ldquo;{existingReview.comment}&rdquo;
          </p>
        )}
      </div>
    );
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setReviewError(null);

    try {
      const response = await api.post(`/api/bookings/${booking.id}/review`, {
        rating,
        comment: comment.trim() || undefined,
      });

      onReviewCreated?.(response);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_REVIEWED') {
        setReviewError('You have already submitted a review for this booking.');
      } else {
        setReviewError(err.message || 'Failed to submit review.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs space-y-4">
      <div>
        <h3 className="font-editorial text-xl font-normal text-ink mb-1">Leave a Review</h3>
        <p className="text-xs text-body">
          Share your experience with the host and future guests of this space.
        </p>
      </div>

      {reviewError && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs">
          {reviewError}
        </div>
      )}

      <form onSubmit={handleSubmitReview} className="space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-body block mb-2">
            Your Rating
          </label>
          <Rating value={rating} onChange={(newVal) => setRating(newVal)} size="lg" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-body">
              Comments (Optional)
            </label>
            <span className="text-2xs text-body">{comment.length} / 1000</span>
          </div>
          <textarea
            maxLength={1000}
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What made your stay special? (Acoustics, natural light, clean facilities...)"
            className="w-full p-3 rounded-2xl border border-border bg-sand/30 text-ink text-sm focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isSubmitting}
        >
          Submit Review
        </Button>
      </form>
    </div>
  );
}

/**
 * Booking Detail Page
 */
export function BookingDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const {
    data: booking,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/api/bookings/${id}`),
    staleTime: 15 * 1000,
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="w-32 h-6 rounded-lg" />
        <Skeleton className="w-full h-48 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="md:col-span-2 h-72 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      </div>
    );
  }

  // 404 state if booking not found or unauthorized
  if (isError || !booking) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4">
          <Building className="w-8 h-8" />
        </div>
        <h2 className="font-editorial text-3xl font-light text-ink mb-2">Reservation Not Found</h2>
        <p className="text-body text-sm mb-6 leading-relaxed">
          {error?.status === 404
            ? "This booking does not exist or you do not have permission to inspect its records."
            : error?.message || 'An error occurred loading the booking.'}
        </p>
        <Link
          to="/bookings"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold uppercase tracking-wider hover:bg-primary-hover shadow-warm-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Bookings</span>
        </Link>
      </div>
    );
  }

  const space = booking.space || {};
  const property = space.property || {};
  const owner = space.property?.owner || {};
  // Strictly display host FIRST NAME only, never full email or phone
  const ownerFirstName = owner.name ? owner.name.trim().split(/\s+/)[0] : 'Owner';

  const totalAmount = parseFloat(booking.totalAmount || '0');
  const paidAmount = parseFloat(booking.paidAmount || '0');
  const balance = Math.max(0, totalAmount - paidAmount);

  const allowedNextActions = booking.allowedNextActions || [];
  const canPay = allowedNextActions.includes('pay') && balance > 0;
  const canCancel = allowedNextActions.includes('cancel');
  const canReview = allowedNextActions.includes('review');

  const handleConfirmCancel = async (reason) => {
    try {
      const result = await api.patch(`/api/bookings/${id}/status`, {
        status: 'CANCELLED',
        reason: reason || undefined,
      });

      const refunded = result?.refundedAmount || '0.00';
      toast.success(`Reservation cancelled. ${formatINR(refunded)} has been processed for refund.`);
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel booking');
    }
  };

  const handlePaymentSuccess = () => {
    toast.success('Payment recorded successfully!');
    queryClient.invalidateQueries({ queryKey: ['booking', id] });
    queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    refetch();
  };

  const handleReviewCreated = () => {
    toast.success('Review submitted successfully!');
    queryClient.invalidateQueries({ queryKey: ['booking', id] });
    refetch();
  };

  return (
    <EdgeSwipeBack fallbackPath="/bookings">
      <div className="max-w-5xl mx-auto space-y-8">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/bookings"
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-body hover:text-ink transition-colors focus-ring rounded"
        >
          <ArrowLeft className="w-4 h-4 text-primary" />
          <span>Back to all reservations</span>
        </Link>

        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCancelModalOpen(true)}
            className="text-danger hover:bg-danger/10 self-start sm:self-auto"
          >
            Cancel Reservation
          </Button>
        )}
      </div>

      {/* Main Reservation Hero Banner */}
      <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xs font-semibold tracking-widest uppercase text-body">
              Ref #{booking.id.slice(0, 8)}
            </span>
            <StatusBadge status={booking.status} type="booking" />
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-light text-ink">
            {space.name || 'Private Space'}
          </h1>
          <p className="text-xs sm:text-sm text-body mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>
              {property.title} &bull; {property.addressLine1 ? `${property.addressLine1}, ` : ''}
              {property.city}, {property.state}
            </span>
          </p>
        </div>

        {/* Host Badge - Privacy rule: strictly FIRST NAME ONLY */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-sand/70 border border-border shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/20 text-ink font-serif font-bold flex items-center justify-center">
            {ownerFirstName[0] || 'H'}
          </div>
          <div className="text-xs">
            <p className="font-semibold text-ink">Hosted by {ownerFirstName}</p>
            <p className="text-2xs text-body">Verified Nexora Steward</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Left Details, Right Payments & Action Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Stay Info & Financial Breakdown */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stay Specifics */}
          <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs space-y-4">
            <h3 className="font-editorial text-xl font-normal text-ink mb-2">Stay Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-sand/50 border border-border/60">
                <span className="text-2xs uppercase tracking-wider text-body block mb-1">Check-in</span>
                <p className="font-semibold text-ink text-sm">
                  {formatKolkataDate(booking.startAt)}
                </p>
                <p className="text-body mt-0.5">{formatKolkataTime(booking.startAt)}</p>
              </div>

              <div className="p-4 rounded-2xl bg-sand/50 border border-border/60">
                <span className="text-2xs uppercase tracking-wider text-body block mb-1">Check-out</span>
                <p className="font-semibold text-ink text-sm">
                  {formatKolkataDate(booking.endAt)}
                </p>
                <p className="text-body mt-0.5">{formatKolkataTime(booking.endAt)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 text-xs text-body">
              <Users className="w-4 h-4 text-primary" />
              <span>
                Capacity reserved for <strong>{booking.guestCount} {booking.guestCount === 1 ? 'Guest' : 'Guests'}</strong>
              </span>
            </div>
          </div>

          {/* Price & Balance Ledger Breakdown */}
          <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs space-y-4">
            <h3 className="font-editorial text-xl font-normal text-ink mb-2">Financial Breakdown</h3>
            <div className="space-y-2.5 text-xs text-body">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span>Base Rate Subtotal</span>
                <span className="font-medium text-ink">{formatINR(booking.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span>Taxes</span>
                <span className="font-medium text-ink">{formatINR(booking.taxAmount)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm font-semibold text-ink pt-1 border-b border-border">
                <span>Total Amount Due</span>
                <span>{formatINR(booking.totalAmount)}</span>
              </div>
              <div className="flex justify-between py-1 text-success font-semibold">
                <span>Paid to Date</span>
                <span>{formatINR(booking.paidAmount)}</span>
              </div>
              <div className="flex justify-between py-2 text-sm font-bold bg-sand/60 px-3 rounded-xl border border-border/60 text-ink">
                <span>Remaining Balance</span>
                <span className={balance > 0 ? 'text-primary' : 'text-success'}>
                  {formatINR(balance)}
                </span>
              </div>
            </div>
          </div>

          {/* Past Payments History Receipts */}
          {booking.payments && booking.payments.length > 0 && (
            <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs space-y-4">
              <h3 className="font-editorial text-xl font-normal text-ink mb-2 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                <span>Payment Receipts</span>
              </h3>

              <div className="divide-y divide-border/60">
                {booking.payments.map((p) => (
                  <div key={p.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{formatINR(p.amount)}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-2xs text-body mt-0.5">
                        {p.paymentMethod} &bull; Ref: {p.transactionReference || p.id}
                      </p>
                    </div>
                    <span className="text-2xs text-body/80 shrink-0">
                      {formatKolkata(p.paidAt || p.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual Status Timeline */}
          <StatusTimeline history={booking.statusHistory} />
        </div>

        {/* Right Column (1 Col): Actions (Pay, Review) strictly according to allowedNextActions */}
        <div className="space-y-6">
          {/* Action: Pay */}
          {canPay && (
            <PaymentPanel
              booking={booking}
              balance={balance}
              onSuccess={handlePaymentSuccess}
            />
          )}

          {/* Action: Review or View Review */}
          {(canReview || booking.review) && (
            <ReviewPanel
              booking={booking}
              existingReview={booking.review}
              onReviewCreated={handleReviewCreated}
            />
          )}

          {/* Space Details Side Card */}
          <div className="bg-sand rounded-3xl p-6 border border-border space-y-3">
            <h4 className="font-editorial text-lg font-normal text-ink">Space Rules</h4>
            <p className="text-xs text-body leading-relaxed">
              {space.rules || 'Quiet hours after 10:00 PM. Please steward this space with care and slow intentionality.'}
            </p>
            <div className="pt-2">
              <Link
                to={`/spaces/${space.id}`}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span>View original space listing</span>
                <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Dialog */}
      <CancellationModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        booking={booking}
        onConfirmCancel={handleConfirmCancel}
      />
    </div>
  </EdgeSwipeBack>
  );
}
