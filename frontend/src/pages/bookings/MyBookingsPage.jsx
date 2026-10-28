import React from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  ArrowRight,
  CreditCard,
  Building,
  RefreshCw,
  Eye,
  Copy,
  XCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PlaceholderImage } from '../../components/ui/PlaceholderImage';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import { ContextMenu } from '../../components/native/ContextMenu';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { formatINR, formatKolkataDate, formatKolkataTime } from '../../lib/utils';
import { cn } from '../../lib/utils';

const TABS = [
  { id: 'all', label: 'All', status: null },
  { id: 'upcoming', label: 'Upcoming', status: 'CONFIRMED' },
  { id: 'pending', label: 'Pending', status: 'PENDING' },
  { id: 'past', label: 'Past', status: 'COMPLETED' },
  { id: 'cancelled', label: 'Cancelled', status: 'CANCELLED' },
];

/**
 * Editorial Booking Card for customer reservations
 */
const BookingCard = React.forwardRef(function BookingCard({ booking }, ref) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const space = booking.space || {};
  const property = space.property || {};
  const coverUrl = space.coverImageUrl;

  const totalAmount = parseFloat(booking.totalAmount || '0');
  const paidAmount = parseFloat(booking.paidAmount || '0');
  const hasBalance = booking.status === 'CONFIRMED' && paidAmount < totalAmount;
  const isPaidInFull = totalAmount > 0 && paidAmount >= totalAmount;
  const progressPercent = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;

  const startFormatted = `${formatKolkataDate(booking.startAt)}, ${formatKolkataTime(booking.startAt)}`;
  const endFormatted = `${formatKolkataDate(booking.endAt)}, ${formatKolkataTime(booking.endAt)}`;

  const menuItems = [
    {
      label: 'View details',
      icon: Eye,
      onClick: () => navigate(`/bookings/${booking.id}`),
    },
    ...(hasBalance
      ? [
          {
            label: `Pay balance (${formatINR(totalAmount - paidAmount)})`,
            icon: CreditCard,
            onClick: () => navigate(`/bookings/${booking.id}?pay=1`),
          },
        ]
      : []),
    {
      label: 'Copy reference',
      icon: Copy,
      onClick: () => {
        navigator.clipboard.writeText(booking.id);
        toast.success('Reservation reference copied');
      },
    },
    ...(booking.status === 'PENDING' || booking.status === 'CONFIRMED'
      ? [
          {
            label: 'Cancel reservation',
            icon: XCircle,
            destructive: true,
            onClick: () => navigate(`/bookings/${booking.id}`),
          },
        ]
      : []),
  ];

  return (
    <ContextMenu items={menuItems} buttonLabel="Booking options">
      <motion.article
        ref={ref}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25 }}
        className="group relative flex flex-col sm:flex-row rounded-3xl bg-card border border-border overflow-hidden hover:shadow-warm-md transition-all duration-300"
      >
      {/* Cover Image or Architectural Placeholder */}
      <div className="relative w-full sm:w-60 md:w-64 h-48 sm:h-auto shrink-0 overflow-hidden bg-sand">
        <Link to={`/bookings/${booking.id}`} className="block w-full h-full focus-ring">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={space.name || 'Space'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <PlaceholderImage
              spaceType={space.spaceType || 'OTHER'}
              title={space.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          )}
        </Link>
        <div className="absolute top-3.5 left-3.5">
          <StatusBadge status={booking.status} type="booking" />
        </div>
      </div>

      {/* Main Booking Details */}
      <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between">
        <div>
          {/* Property & City */}
          <div className="flex items-center gap-1.5 text-xs text-body font-medium mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">
              {property.title || 'Property'} &bull; {property.city || ''}
              {property.state ? `, ${property.state}` : ''}
            </span>
          </div>

          {/* Space Name */}
          <Link
            to={`/bookings/${booking.id}`}
            className="font-serif text-xl sm:text-2xl font-bold text-ink hover:text-primary transition-colors block mb-3 focus-ring rounded"
          >
            {space.name || 'Private Space'}
          </Link>

          {/* Timing & Guests Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-body mb-4">
            <div className="flex items-center gap-1.5 truncate">
              <Calendar className="w-3.5 h-3.5 text-body/70 shrink-0" />
              <span className="truncate">
                {startFormatted} &ndash; {endFormatted}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-body/70 shrink-0" />
              <span>
                {booking.guestCount} {booking.guestCount === 1 ? 'Guest' : 'Guests'}
              </span>
            </div>
          </div>
        </div>

        {/* Pricing, Payment Progress Bar & Primary Action */}
        <div className="pt-4 border-t border-border/80 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          {/* Financial summary & bar */}
          <div className="flex-1 max-w-xs">
            <div className="flex items-baseline justify-between text-xs mb-1.5">
              <span className="text-body font-medium">
                Paid: <strong className="text-ink">{formatINR(paidAmount)}</strong>
              </span>
              <span className="text-body font-medium">
                Total: <strong className="text-ink">{formatINR(totalAmount)}</strong>
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-sand rounded-xl overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-500 rounded-xl',
                  isPaidInFull ? 'bg-success' : hasBalance ? 'bg-amber' : 'bg-primary'
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Action button */}
          <div className="shrink-0 flex items-center justify-end">
            {booking.status === 'PENDING' ? (
              <Link
                to={`/bookings/${booking.id}`}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-border text-body hover:text-ink text-xs font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Waiting for owner</span>
                <Clock className="w-3.5 h-3.5" />
              </Link>
            ) : hasBalance ? (
              <Link
                to={`/bookings/${booking.id}?pay=1`}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-semibold tracking-wider uppercase transition-all shadow-warm-xs flex items-center justify-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay now ({formatINR(totalAmount - paidAmount)})</span>
              </Link>
            ) : (
              <Link
                to={`/bookings/${booking.id}`}
                className="w-full sm:w-auto px-5 py-2 rounded-xl border border-border bg-card hover:bg-sand text-ink text-xs font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5"
              >
                <span>View details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  </ContextMenu>
  );
});

BookingCard.displayName = 'BookingCard';

/**
 * Customer My Bookings Page with editorial tabs, filters, pagination and cards
 */
export function MyBookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'all';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const selectedTabObj = TABS.find((t) => t.id === currentTab) || TABS[0];
  const statusFilter = selectedTabObj.status;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['my-bookings', { status: statusFilter, page: currentPage }],
    queryFn: () => {
      const params = {
        page: currentPage,
        pageSize: 6,
      };
      if (statusFilter) {
        params.status = statusFilter;
      }
      return api.get('/api/bookings/mine', { params });
    },
    staleTime: 30 * 1000,
  });

  const bookings = data?.data || (Array.isArray(data) ? data : []);
  const meta = data?.meta || { page: currentPage, pageSize: 6, total: bookings.length, totalPages: 1 };

  const handleTabChange = (tabId) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tabId === 'all') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tabId);
    }
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const handlePageChange = (newPage) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', String(newPage));
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Editorial Page Header with CollapsingTitle */}
      <CollapsingTitle
        title="My Bookings"
        subtitle="Manage your reservations, check payment balances, review receipts, and monitor host confirmations."
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-sand text-xs font-semibold uppercase tracking-wider text-body hover:text-ink transition-colors focus-ring"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Editorial Navigation Tabs */}
      <nav
        className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/60 scrollbar-none"
        aria-label="Booking status tabs"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === currentTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all whitespace-nowrap focus-ring',
                isActive
                  ? 'bg-primary text-white shadow-warm-xs'
                  : 'bg-card border border-border text-body hover:text-ink hover:bg-sand'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex flex-col sm:flex-row rounded-3xl bg-card border border-border p-4 gap-4">
              <Skeleton className="w-full sm:w-60 h-44 rounded-2xl" />
              <div className="flex-1 space-y-3 py-2">
                <Skeleton className="w-3/4 h-6 rounded-lg" />
                <Skeleton className="w-1/2 h-4 rounded-lg" />
                <Skeleton className="w-full h-8 rounded-lg mt-6" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load reservations"
          message={error?.message || 'A network error occurred while retrieving your bookings.'}
          onRetry={refetch}
        />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={Building}
          title={
            currentTab === 'all'
              ? 'No reservations yet'
              : `No ${selectedTabObj.label.toLowerCase()} bookings found`
          }
          description="Explore available rooms, offices, and studios across India."
          actionLabel="Browse spaces"
          onAction={() => {}}
        >
          <Link
            to="/#spaces"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold tracking-wider uppercase hover:bg-primary-hover shadow-warm-xs transition-all focus-ring"
          >
            <span>Browse spaces</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </AnimatePresence>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="pt-6">
              <Pagination
                currentPage={meta.page}
                totalPages={meta.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
