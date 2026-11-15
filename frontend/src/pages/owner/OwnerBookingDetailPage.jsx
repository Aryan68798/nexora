import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  Users,
  MapPin,
  CreditCard,
  Phone,
  User,
  Calendar,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { api, ApiError } from '../../api/client';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { EdgeSwipeBack } from '../../components/native/EdgeSwipeBack';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { ConfirmSheet } from '../../components/owner/ConfirmSheet';
import { haptics } from '../../lib/haptics';
import {
  formatINR,
  formatKolkataDate,
  formatKolkataTime,
  formatKolkata,
  cn,
} from '../../lib/utils';

export function OwnerBookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Dialog states for status actions
  const [activeAction, setActiveAction] = useState(null); // 'confirm' | 'reject' | 'cancel' | 'complete'
  const [reasonInput, setReasonInput] = useState('');
  const [actionError, setActionError] = useState(null);

  // Fetch booking details
  const {
    data: responseData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['booking-detail', id],
    queryFn: () => api.get(`/api/bookings/${id}`),
    enabled: !!id,
  });

  const booking = responseData?.data || responseData;
  const allowedNextActions = booking?.allowedNextActions || [];

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: ({ status, reason }) =>
      api.patch(`/api/bookings/${id}/status`, { status, reason }),
    onSuccess: (_, variables) => {
      haptics.success();
      queryClient.invalidateQueries(['booking-detail', id]);
      queryClient.invalidateQueries(['owner-bookings']);
      queryClient.invalidateQueries(['owner-pending-count']);

      setActiveAction(null);
      setReasonInput('');
      setActionError(null);

      const statusMap = {
        CONFIRMED: 'confirmed',
        REJECTED: 'declined',
        CANCELLED: 'cancelled',
        COMPLETED: 'marked completed',
      };
      const text = statusMap[variables.status] || 'updated';

      toast?.success?.(`The reservation status has been ${text}.`);
    },
    onError: (err) => {
      haptics.warning();
      let msg = 'Failed to update booking status.';
      if (err instanceof ApiError) {
        if (err.data?.code === 'SLOT_UNAVAILABLE') {
          msg = 'Time slot conflict: another confirmed booking overlaps with this schedule.';
        } else if (err.data?.code === 'INVALID_TRANSITION') {
          msg = 'Invalid transition: this booking cannot be moved to that status.';
        } else if (err.data?.code === 'BOOKING_NOT_ENDED') {
          msg = 'Cannot complete: the reservation end time has not yet passed.';
        } else {
          msg = err.message || msg;
        }
      }
      setActionError(msg);
      toast?.error?.(msg);
    },
  });

  const executeStatusUpdate = () => {
    setActionError(null);
    if (activeAction === 'confirm') {
      statusMutation.mutate({ status: 'CONFIRMED' });
    } else if (activeAction === 'reject') {
      statusMutation.mutate({
        status: 'REJECTED',
        reason: reasonInput.trim() || 'Declined by space owner',
      });
    } else if (activeAction === 'cancel') {
      statusMutation.mutate({
        status: 'CANCELLED',
        reason: reasonInput.trim() || 'Cancelled by space owner',
      });
    } else if (activeAction === 'complete') {
      statusMutation.mutate({ status: 'COMPLETED' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-60 rounded-3xl" />
          <Skeleton className="h-60 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="bg-card rounded-3xl p-8 border border-border text-center max-w-md w-full shadow-warm-xs">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="font-editorial text-2xl text-ink font-semibold mb-2">
            Reservation Not Found
          </h2>
          <p className="text-sm text-body mb-6">
            {error?.message || 'The requested booking could not be loaded or you do not have permission.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => refetch()} className="min-h-[44px]">
              Retry
            </Button>
            <Button variant="primary" onClick={() => navigate('/owner/bookings')} className="min-h-[44px]">
              Back to Bookings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const space = booking.space;
  const property = space?.property;
  const customer = booking.customer;
  const payments = booking.payments || [];
  const statusHistory = booking.statusHistory || [];

  const subtotal = Number(booking.subtotal || 0);
  const platformFee = Number(booking.platformFee || 0);
  const taxAmount = Number(booking.taxAmount || 0);
  const totalAmount = Number(booking.totalAmount || 0);
  const ownerAmount = Number(booking.ownerAmount || subtotal * 0.9);
  const paidAmount = Number(booking.paidAmount || 0);
  const remainingBalance = Math.max(0, totalAmount - paidAmount);

  return (
    <EdgeSwipeBack onSwipe={() => navigate('/owner/bookings')}>
      <div className="min-h-screen bg-cream pb-24">
        {/* Top Navigation */}
        <div className="bg-cream border-b border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              to="/owner/bookings"
              className="inline-flex items-center gap-2 text-sm text-body hover:text-ink font-medium min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Booking Requests</span>
            </Link>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
          {/* Header Card */}
          <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-2xs font-semibold uppercase tracking-wider text-primary">
                  Booking Reference #{booking.id.slice(0, 8)}
                </span>
                <h1 className="font-editorial text-2xl sm:text-3xl text-ink font-semibold">
                  {space?.name || 'Space Reservation'}
                </h1>
                <p className="text-xs sm:text-sm text-body flex items-center gap-1.5 pt-0.5">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    {property?.title} &bull; {property?.addressLine1}, {property?.city}, {property?.state}
                  </span>
                </p>
              </div>
              <StatusBadge status={booking.status} />
            </div>

            {/* Quick action bar driven strictly by allowedNextActions */}
            {allowedNextActions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-ink uppercase tracking-wider mr-2">
                  Allowed Actions:
                </span>

                {allowedNextActions.includes('confirm') && (
                  <Button
                    variant="primary"
                    onClick={() => setActiveAction('confirm')}
                    className="min-h-[44px]"
                  >
                    Confirm Booking
                  </Button>
                )}

                {allowedNextActions.includes('reject') && (
                  <Button
                    variant="outline"
                    onClick={() => setActiveAction('reject')}
                    className="text-danger border-danger/30 hover:bg-danger/10 min-h-[44px]"
                  >
                    Reject Request
                  </Button>
                )}

                {allowedNextActions.includes('cancel') && (
                  <Button
                    variant="outline"
                    onClick={() => setActiveAction('cancel')}
                    className="text-danger border-danger/30 hover:bg-danger/10 min-h-[44px]"
                  >
                    Cancel Booking
                  </Button>
                )}

                {allowedNextActions.includes('complete') && (
                  <Button
                    variant="primary"
                    onClick={() => setActiveAction('complete')}
                    className="bg-success hover:bg-success/90 text-white min-h-[44px]"
                  >
                    Mark as Completed
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Guest and Schedule Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Guest Details (NO EMAIL) */}
            <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs space-y-4">
              <h3 className="font-editorial text-xl font-semibold text-ink flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <span>Guest Information</span>
              </h3>

              <div className="space-y-3 pt-2">
                <div>
                  <span className="text-2xs uppercase tracking-wider text-body block font-medium">
                    Guest Name
                  </span>
                  <span className="text-base font-semibold text-ink">
                    {customer?.name || 'Guest User'}
                  </span>
                </div>

                <div>
                  <span className="text-2xs uppercase tracking-wider text-body block font-medium">
                    Contact Phone
                  </span>
                  {customer?.phone ? (
                    <a
                      href={`tel:${customer.phone}`}
                      className="text-sm font-semibold text-primary hover:underline flex items-center gap-1.5 mt-0.5"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{customer.phone}</span>
                    </a>
                  ) : (
                    <span className="text-sm text-body/70">Not provided</span>
                  )}
                </div>

                <div>
                  <span className="text-2xs uppercase tracking-wider text-body block font-medium">
                    Party Size
                  </span>
                  <span className="text-sm text-ink flex items-center gap-1.5 mt-0.5 font-medium">
                    <Users className="w-4 h-4 text-body" />
                    <span>{booking.guestCount} registered guests</span>
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-sand/50 border border-border/60 text-xs text-body leading-relaxed mt-4">
                  For guest privacy, direct email addresses are suppressed on owner booking management.
                </div>
              </div>
            </div>

            {/* Schedule & Timing */}
            <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs space-y-4">
              <h3 className="font-editorial text-xl font-semibold text-ink flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span>Reservation Schedule</span>
              </h3>

              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-sand/40 border border-border/40 space-y-3">
                  <div>
                    <span className="text-2xs uppercase tracking-wider text-primary block font-semibold">
                      Check-in
                    </span>
                    <span className="text-sm font-semibold text-ink block mt-0.5">
                      {formatKolkataDate(booking.startAt)} at {formatKolkataTime(booking.startAt)}
                    </span>
                  </div>

                  <div className="border-t border-border/50 pt-2.5">
                    <span className="text-2xs uppercase tracking-wider text-primary block font-semibold">
                      Check-out
                    </span>
                    <span className="text-sm font-semibold text-ink block mt-0.5">
                      {formatKolkataDate(booking.endAt)} at {formatKolkataTime(booking.endAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-body pt-1">
                  <span>Space Type:</span>
                  <span className="font-medium text-ink">{space?.spaceType || 'Standard'}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-body">
                  <span>Max Capacity:</span>
                  <span className="font-medium text-ink">{space?.capacity || 0} people</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs space-y-5">
            <h3 className="font-editorial text-xl font-semibold text-ink flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              <span>Financial Overview</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-sand/40 border border-border">
                <span className="text-2xs uppercase tracking-wider text-body block font-medium">
                  Total Customer Charge
                </span>
                <span className="text-xl font-semibold text-ink block mt-1">
                  {formatINR(totalAmount)}
                </span>
                <span className="text-2xs text-body/70 mt-1 block">
                  Includes {formatINR(taxAmount)} taxes
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-sand/40 border border-border">
                <span className="text-2xs uppercase tracking-wider text-body block font-medium">
                  Platform Fee
                </span>
                <span className="text-xl font-semibold text-body block mt-1">
                  -{formatINR(platformFee)}
                </span>
                <span className="text-2xs text-body/70 mt-1 block">Deducted from base subtotal</span>
              </div>

              <div className="p-4 rounded-2xl bg-sand/80 border border-primary/30">
                <span className="text-2xs uppercase tracking-wider text-primary block font-semibold">
                  Net Owner Payout
                </span>
                <span className="text-xl font-semibold text-primary block mt-1">
                  {formatINR(ownerAmount)}
                </span>
                <span className="text-2xs text-body/80 mt-1 block">Subtotal less platform fee</span>
              </div>
            </div>

            <div className="border-t border-border pt-4 flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-2xs text-body uppercase tracking-wider block">Customer Paid</span>
                  <span className="font-semibold text-success">{formatINR(paidAmount)}</span>
                </div>
                <div>
                  <span className="text-2xs text-body uppercase tracking-wider block">Remaining Balance</span>
                  <span className={cn('font-semibold', remainingBalance > 0 ? 'text-warning' : 'text-body')}>
                    {formatINR(remainingBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payments List */}
          <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs space-y-4">
            <h3 className="font-editorial text-xl font-semibold text-ink flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <span>Payments Received</span>
            </h3>

            {payments.length === 0 ? (
              <p className="text-xs text-body py-4">No payments recorded for this booking yet.</p>
            ) : (
              <div className="space-y-3 pt-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between p-3.5 rounded-2xl bg-sand/30 border border-border/60 gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink">{p.paymentMethod}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <span className="text-2xs text-body/80 block mt-0.5">
                        Ref: {p.transactionReference || 'N/A'} &bull;{' '}
                        {formatKolkata(p.paidAt || p.createdAt, 'dd MMM yyyy, hh:mm a')}
                      </span>
                    </div>
                    <span className="font-semibold text-sm text-ink">{formatINR(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Timeline */}
          {statusHistory.length > 0 && (
            <div className="bg-card rounded-3xl p-6 sm:p-8 border border-border shadow-warm-xs space-y-6">
              <h3 className="font-editorial text-xl font-semibold text-ink flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <span>Reservation Timeline</span>
              </h3>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {statusHistory.map((item, idx) => (
                  <div key={item.id || idx} className="relative">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-primary bg-card flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-baseline gap-2 mb-1">
                        <span className="font-semibold text-sm text-ink">{item.status}</span>
                        <span className="text-xs text-body">&bull;</span>
                        <span className="text-xs text-body font-medium">{item.changedBy}</span>
                        <span className="text-2xs text-body/70 ml-auto">
                          {formatKolkata(item.changedAt, 'dd MMM yyyy, hh:mm a')}
                        </span>
                      </div>
                      {item.note && (
                        <p className="text-xs text-body bg-sand/60 p-2.5 rounded-xl border border-border/50 mt-1">
                          {item.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Confirmation Sheets */}
        <ConfirmSheet
          isOpen={!!activeAction}
          onClose={() => {
            setActiveAction(null);
            setReasonInput('');
            setActionError(null);
          }}
          onConfirm={executeStatusUpdate}
          title={
            activeAction === 'confirm'
              ? 'Confirm Reservation'
              : activeAction === 'reject'
              ? 'Reject Request'
              : activeAction === 'cancel'
              ? 'Cancel Booking'
              : 'Complete Booking'
          }
          description={
            activeAction === 'confirm'
              ? `Confirm booking for ${customer?.name || 'the guest'}. Once confirmed, the guest can make payments towards their balance.`
              : activeAction === 'reject'
              ? 'Are you sure you want to decline this reservation request?'
              : activeAction === 'cancel'
              ? 'Cancelling a confirmed booking will notify the guest. Any payments made will be refunded according to the cancellation policy.'
              : 'Mark this booking completed once the reservation time has concluded and the guest has vacated the space.'
          }
          confirmLabel={
            activeAction === 'confirm'
              ? 'Confirm Reservation'
              : activeAction === 'reject'
              ? 'Reject Request'
              : activeAction === 'cancel'
              ? 'Cancel Booking'
              : 'Mark Completed'
          }
          cancelLabel="Back"
          variant={activeAction === 'reject' || activeAction === 'cancel' ? 'danger' : 'primary'}
          isPending={statusMutation.isPending}
        >
          <div className="space-y-3 mb-2">
            {actionError && (
              <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger">
                {actionError}
              </div>
            )}
            {(activeAction === 'reject' || activeAction === 'cancel') && (
              <div>
                <label htmlFor="action-reason" className="block text-xs font-medium text-ink mb-1">
                  Reason for {activeAction === 'reject' ? 'rejection' : 'cancellation'}:
                </label>
                <textarea
                  id="action-reason"
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Optional explanatory note for the guest"
                  className="w-full text-xs p-3 rounded-xl border border-border bg-sand/30 text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
          </div>
        </ConfirmSheet>
      </div>
    </EdgeSwipeBack>
  );
}
