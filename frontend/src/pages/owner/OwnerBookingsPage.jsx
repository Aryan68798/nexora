import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { api, ApiError } from '../../api/client';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { ContextMenu } from '../../components/native/ContextMenu';
import { SwipeRow } from '../../components/native/SwipeRow';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { ConfirmSheet } from '../../components/owner/ConfirmSheet';
import { haptics } from '../../lib/haptics';
import { formatINR, formatKolkata, cn } from '../../lib/utils';

const STATUS_TABS = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ALL', label: 'All Requests' },
];

export function OwnerBookingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('PENDING');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [page, setPage] = useState(1);

  // Sheet dialog states
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState(null);

  // Fetch properties for filter selector
  const { data: propertiesData } = useQuery({
    queryKey: ['owner-properties-filter'],
    queryFn: () => api.get('/api/properties?mine=true&pageSize=100'),
    staleTime: 60000,
  });

  const properties = propertiesData?.data || [];

  // Fetch owner bookings
  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('pageSize', '20');
  if (activeTab !== 'ALL') {
    queryParams.set('status', activeTab);
  }
  if (selectedPropertyId) {
    queryParams.set('propertyId', selectedPropertyId);
  }

  const {
    data: bookingsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['owner-bookings', activeTab, selectedPropertyId, page],
    queryFn: () => api.get(`/api/owner/bookings?${queryParams.toString()}`),
  });

  const bookings = bookingsData?.data || [];
  const meta = bookingsData?.meta || {};
  const totalPages = meta.totalPages || 1;

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }) =>
      api.patch(`/api/bookings/${id}/status`, { status, reason }),
    onSuccess: (_, variables) => {
      haptics.success();
      queryClient.invalidateQueries(['owner-bookings']);
      queryClient.invalidateQueries(['owner-pending-count']);
      setConfirmTarget(null);
      setRejectTarget(null);
      setRejectionReason('');
      setActionError(null);

      const actionText = variables.status === 'CONFIRMED' ? 'confirmed' : 'rejected';
      toast?.success?.(`Booking ${actionText}`);
    },
    onError: (err) => {
      haptics.warning();
      let msg = 'Failed to update booking status.';
      if (err instanceof ApiError) {
        if (err.data?.code === 'SLOT_UNAVAILABLE') {
          msg = 'Time slot unavailable: another booking conflicts with this schedule.';
        } else if (err.data?.code === 'INVALID_TRANSITION') {
          msg = 'Invalid transition: this booking cannot be moved to that status.';
        } else {
          msg = err.message || msg;
        }
      }
      setActionError(msg);
      toast?.error?.(msg);
    },
  });

  const handleConfirmAction = () => {
    if (!confirmTarget) return;
    setActionError(null);
    statusMutation.mutate({
      id: confirmTarget.id,
      status: 'CONFIRMED',
    });
  };

  const handleRejectAction = () => {
    if (!rejectTarget) return;
    setActionError(null);
    statusMutation.mutate({
      id: rejectTarget.id,
      status: 'REJECTED',
      reason: rejectionReason.trim() || 'Declined by space owner',
    });
  };

  return (
    <div className="min-h-screen bg-cream pb-24">
      {/* Top Header */}
      <CollapsingTitle
        title="Booking Requests"
        subtitle="Manage reservation inquiries and check-ins across your spaces"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Filters and Tabs */}
        <div className="space-y-4 mb-6">
          {/* Status Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {STATUS_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    haptics.light();
                    setActiveTab(tab.id);
                    setPage(1);
                  }}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-colors min-h-[44px]',
                    isActive
                      ? 'bg-primary text-white shadow-warm-xs'
                      : 'bg-card text-body hover:text-ink hover:bg-sand/60 border border-border'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Property Filter Dropdown */}
          {properties.length > 0 && (
            <div className="flex items-center gap-3 bg-card p-3 rounded-2xl border border-border max-w-sm">
              <Filter className="w-4 h-4 text-body shrink-0 ml-1" />
              <label htmlFor="property-filter" className="sr-only">
                Filter by Property
              </label>
              <select
                id="property-filter"
                value={selectedPropertyId}
                onChange={(e) => {
                  setSelectedPropertyId(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-sm text-ink font-medium focus:outline-none w-full cursor-pointer"
              >
                <option value="">All Managed Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.city})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Content area */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl p-5 border border-border space-y-4">
                <div className="flex gap-4">
                  <Skeleton className="w-20 h-20 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="bg-card rounded-2xl p-8 border border-border text-center max-w-lg mx-auto">
            <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
            <h3 className="font-editorial text-lg text-ink font-semibold mb-2">
              Unable to load booking requests
            </h3>
            <p className="text-body text-sm mb-4">
              {error?.message || 'Something went wrong while retrieving bookings.'}
            </p>
            <Button variant="secondary" onClick={() => refetch()} className="min-h-[44px]">
              Try Again
            </Button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-card rounded-3xl p-10 border border-border text-center max-w-md mx-auto my-12">
            <Calendar className="w-12 h-12 text-primary/60 mx-auto mb-4" />
            <h3 className="font-editorial text-xl text-ink font-semibold mb-2">
              No booking requests found
            </h3>
            <p className="text-body text-sm mb-6">
              {activeTab === 'ALL'
                ? 'Your spaces have not received any booking requests yet.'
                : `There are currently no bookings with status: ${activeTab.toLowerCase()}.`}
            </p>
            <Link to="/owner/properties">
              <Button variant="outline" className="min-h-[44px]">
                View Properties
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const isPending = booking.status === 'PENDING';
              const coverImage = booking.space?.coverImageUrl;
              const customerName = booking.customer?.name || 'Guest User';
              const customerPhone = booking.customer?.phone;
              const startFormatted = formatKolkata(booking.startAt, 'dd MMM yyyy, hh:mm a');
              const endFormatted = formatKolkata(booking.endAt, 'dd MMM yyyy, hh:mm a');

              const contextMenuItems = [
                {
                  label: 'View Full Details',
                  icon: <Eye className="w-4 h-4 text-primary" />,
                  action: () => {
                    window.location.href = `/owner/bookings/${booking.id}`;
                  },
                },
                ...(isPending
                  ? [
                      {
                        label: 'Confirm Booking',
                        icon: <CheckCircle2 className="w-4 h-4 text-success" />,
                        action: () => setConfirmTarget(booking),
                      },
                      {
                        label: 'Reject Request',
                        icon: <XCircle className="w-4 h-4 text-danger" />,
                        danger: true,
                        action: () => setRejectTarget(booking),
                      },
                    ]
                  : []),
              ];

              const bookingCard = (
                <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start">
                  {/* Space Thumbnail */}
                  <div className="w-full sm:w-28 h-28 rounded-xl bg-sand overflow-hidden shrink-0 border border-border/60">
                    {coverImage ? (
                      <img
                        src={coverImage}
                        alt={booking.space?.name || 'Space'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-body/50 text-xs">
                        No Photo
                      </div>
                    )}
                  </div>

                  {/* Booking Details */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-editorial text-lg text-ink font-semibold truncate">
                          {booking.space?.name || 'Space Reservation'}
                        </h4>
                        <p className="text-xs text-body flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>
                            {booking.space?.property?.title || 'Property'} - {booking.space?.property?.city || 'Location'}
                          </span>
                        </p>
                      </div>
                      <StatusBadge status={booking.status} />
                    </div>

                    {/* Customer & Guest Info (NO EMAIL) */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink/80 pt-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <User className="w-3.5 h-3.5 text-body" />
                        <span>{customerName}</span>
                      </span>

                      {customerPhone && (
                        <a
                          href={`tel:${customerPhone}`}
                          className="flex items-center gap-1.5 text-primary hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{customerPhone}</span>
                        </a>
                      )}

                      <span className="flex items-center gap-1.5 text-body">
                        <Users className="w-3.5 h-3.5" />
                        <span>{booking.guestCount} guests</span>
                      </span>
                    </div>

                    {/* Date/Time */}
                    <div className="text-xs text-body bg-sand/40 p-2.5 rounded-xl border border-border/40 space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>
                          <strong className="text-ink font-medium">Check-in:</strong> {startFormatted}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pl-5.5">
                        <span>
                          <strong className="text-ink font-medium">Check-out:</strong> {endFormatted}
                        </span>
                      </div>
                    </div>

                    {/* Financial summary */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-body block text-2xs">Total:</span>
                          <span className="font-semibold text-ink text-sm">
                            {formatINR(booking.totalAmount)}
                          </span>
                        </div>
                        <div className="border-l border-border pl-4">
                          <span className="text-body block text-2xs">Owner Payout:</span>
                          <span className="font-semibold text-primary text-sm">
                            {formatINR(booking.ownerAmount || Number(booking.subtotal || 0) * 0.9)}
                          </span>
                        </div>
                        <div className="border-l border-border pl-4">
                          <span className="text-body block text-2xs">Paid:</span>
                          <span className="font-medium text-body text-sm">
                            {formatINR(booking.paidAmount || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-2">
                        {isPending && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRejectTarget(booking);
                              }}
                              className="text-danger border-danger/30 hover:bg-danger/10 min-h-[40px]"
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmTarget(booking);
                              }}
                              className="min-h-[40px]"
                            >
                              Confirm
                            </Button>
                          </>
                        )}
                        <Link to={`/owner/bookings/${booking.id}`}>
                          <Button size="sm" variant="secondary" className="min-h-[40px] gap-1">
                            <span>Details</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <ContextMenu items={contextMenuItems} />
                      </div>
                    </div>
                  </div>
                </div>
              );

              return (
                <div key={booking.id}>
                  {isPending ? (
                    <SwipeRow
                      onAction={() => setRejectTarget(booking)}
                      actionLabel="Reject"
                      actionIcon={<XCircle className="w-4 h-4 text-white" />}
                      actionVariant="danger"
                    >
                      {bookingCard}
                    </SwipeRow>
                  ) : (
                    <div className="bg-card rounded-2xl border border-border shadow-warm-xs">
                      {bookingCard}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-border mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[44px]"
                >
                  Previous
                </Button>
                <span className="text-xs text-body font-medium">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="min-h-[44px]"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm Booking Sheet */}
      <ConfirmSheet
        isOpen={!!confirmTarget}
        onClose={() => {
          setConfirmTarget(null);
          setActionError(null);
        }}
        onConfirm={handleConfirmAction}
        title="Confirm Booking Request"
        description={`Confirm reservation for ${confirmTarget?.customer?.name || 'the guest'} for ${confirmTarget?.space?.name || 'this space'}? Once confirmed, the guest will be notified to settle payment.`}
        confirmLabel="Confirm Reservation"
        cancelLabel="Back"
        variant="primary"
        isPending={statusMutation.isPending}
      >
        {actionError && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger mb-3">
            {actionError}
          </div>
        )}
      </ConfirmSheet>

      {/* Reject Booking Sheet */}
      <ConfirmSheet
        isOpen={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null);
          setRejectionReason('');
          setActionError(null);
        }}
        onConfirm={handleRejectAction}
        title="Reject Booking Request"
        description={`Decline reservation request for ${rejectTarget?.space?.name || 'this space'}. Please provide an optional reason for the guest.`}
        confirmLabel="Reject Request"
        cancelLabel="Back"
        variant="danger"
        isPending={statusMutation.isPending}
      >
        <div className="space-y-3 mb-2">
          {actionError && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger">
              {actionError}
            </div>
          )}
          <label htmlFor="rejection-reason" className="block text-xs font-medium text-ink">
            Reason for rejection:
          </label>
          <textarea
            id="rejection-reason"
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Scheduled space maintenance or private event"
            className="w-full text-xs p-3 rounded-xl border border-border bg-sand/30 text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </ConfirmSheet>
    </div>
  );
}
