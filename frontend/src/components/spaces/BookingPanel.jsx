import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Users, CheckCircle2, AlertCircle, ShieldAlert, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../features/auth/useAuth';
import { api, ApiError } from '../../api/client';
import { Price } from '../ui/Price';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { formatKolkata, cn } from '../../lib/utils';

/**
 * Editorial Booking Panel
 * Supports live server quotes with animated price breakdown,
 * guest selection restoration, non-customer warnings, and in-page booking confirmation.
 */
export function BookingPanel({
  space,
  blockedIntervals = [],
  onRefreshAvailability,
  className = '',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, role } = useAuth();

  const isNonCustomerAuth = isAuthenticated && role !== 'CUSTOMER';

  // Booking selection state
  const [bookingDates, setBookingDates] = useState({ startAt: null, endAt: null });
  const [guestCount, setGuestCount] = useState(1);

  // Quote & submission state
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const abortControllerRef = useRef(null);

  // Restore draft selection from sessionStorage if user logged in
  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem('nexora:booking_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.spaceId === space.id) {
          if (parsed.startAt && parsed.endAt) {
            setBookingDates({ startAt: parsed.startAt, endAt: parsed.endAt });
          }
          if (parsed.guestCount) {
            setGuestCount(parsed.guestCount);
          }
          sessionStorage.removeItem('nexora:booking_draft');
        }
      }
    } catch (e) {
      console.warn('Failed to restore booking draft:', e);
    }
  }, [space.id]);

  // Debounced quote fetch
  const fetchQuote = useCallback(
    async (startAt, endAt, guests) => {
      if (!startAt || !endAt) {
        setQuote(null);
        return;
      }

      // Cancel previous in-flight quote request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setQuoteLoading(true);
      setQuoteError(null);

      try {
        const result = await api.post(
          '/api/bookings/quote',
          {
            spaceId: space.id,
            startAt,
            endAt,
            guestCount: guests,
          },
          { signal: abortControllerRef.current.signal }
        );

        setQuote(result);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setQuote(null);
        setQuoteError(err.message || 'Unable to quote for selected interval.');
      } finally {
        setQuoteLoading(false);
      }
    },
    [space.id]
  );

  // Trigger quote when dates or guest count change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (bookingDates.startAt && bookingDates.endAt) {
        fetchQuote(bookingDates.startAt, bookingDates.endAt, guestCount);
      } else {
        setQuote(null);
        setQuoteError(null);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [bookingDates.startAt, bookingDates.endAt, guestCount, fetchQuote]);

  // Stepper handlers
  const handleDecrementGuests = () => {
    setGuestCount((prev) => Math.max(1, prev - 1));
  };

  const handleIncrementGuests = () => {
    setGuestCount((prev) => {
      if (space.capacity && prev >= space.capacity) return prev;
      return prev + 1;
    });
  };

  // Primary action: Request to book
  const handleSubmitBooking = async () => {
    setSubmitError(null);

    // 1. If not authenticated: save draft and redirect to login
    if (!isAuthenticated) {
      sessionStorage.setItem(
        'nexora:booking_draft',
        JSON.stringify({
          spaceId: space.id,
          startAt: bookingDates.startAt,
          endAt: bookingDates.endAt,
          guestCount,
        })
      );
      navigate('/login', { state: { from: location } });
      return;
    }

    // 2. If non-customer authenticated role, prevent request
    if (isNonCustomerAuth) {
      setSubmitError(`Only customer accounts can request space bookings. You are signed in as an ${role}.`);
      return;
    }

    if (!bookingDates.startAt || !bookingDates.endAt) {
      setSubmitError('Please select valid check-in and check-out dates.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await api.post('/api/bookings', {
        spaceId: space.id,
        startAt: bookingDates.startAt,
        endAt: bookingDates.endAt,
        guestCount,
      });

      setConfirmedBooking(created);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'SLOT_UNAVAILABLE') {
          setSubmitError('The selected time slot is no longer available. Please select another time.');
          onRefreshAvailability?.();
        } else if (err.code === 'OWN_PROPERTY') {
          setSubmitError('You cannot book a space in your own property.');
        } else if (err.code === 'LEAD_TIME_VIOLATION') {
          setSubmitError('Bookings must be requested at least 30 minutes in advance.');
        } else if (err.code === 'CAPACITY_EXCEEDED') {
          setSubmitError(`Guest count exceeds maximum capacity (${space.capacity}).`);
        } else {
          setSubmitError(err.message || 'Failed to submit booking request.');
        }
      } else {
        setSubmitError(err.message || 'An error occurred while creating your reservation.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // SUCCESS STATE: In-page reservation confirmation
  // -------------------------------------------------------------
  if (confirmedBooking) {
    return (
      <div className={cn('bg-card rounded-3xl border border-border p-6 sm:p-8 shadow-warm-md text-ink space-y-6', className)}>
        <div className="w-14 h-14 rounded-2xl bg-success/15 text-success flex items-center justify-center mx-auto shadow-warm-xs">
          <CheckCircle2 className="w-7 h-7" />
        </div>

        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 rounded-xl text-2xs font-bold uppercase tracking-wider bg-success/10 text-success">
            Request Sent
          </span>
          <h3 className="font-editorial text-2xl font-normal text-ink">
            Request sent. The owner will confirm it.
          </h3>
          <p className="text-body text-xs sm:text-sm leading-relaxed max-w-sm mx-auto">
            Your booking request has been delivered to the property steward. No payment has been charged yet.
          </p>
        </div>

        {/* Summary Details */}
        <div className="p-4 rounded-2xl bg-sand/70 border border-border space-y-3 text-xs sm:text-sm">
          <div className="flex justify-between items-center pb-2 border-b border-border/60">
            <span className="text-body">Booking Ref:</span>
            <span className="font-mono font-semibold text-ink">
              {confirmedBooking.id?.slice(0, 8).toUpperCase()}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-body">Space:</span>
            <span className="font-medium text-ink text-right">{space.name}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-body">Schedule:</span>
            <span className="font-medium text-ink text-right">
              {formatKolkata(confirmedBooking.startAt, 'dd MMM, hh:mm a')}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-body">Guests:</span>
            <span className="font-medium text-ink">{confirmedBooking.guestCount}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border/60">
            <span className="font-semibold text-ink">Total Quoted:</span>
            <Price amount={confirmedBooking.totalAmount} size="md" className="text-primary font-bold" />
          </div>
        </div>

        {/* Action Links */}
        <div className="space-y-2 pt-2">
          <Link to="/bookings" className="block">
            <Button variant="primary" className="w-full justify-center shadow-warm-sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
              View My Bookings
            </Button>
          </Link>
          <Link to="/explore" className="block">
            <Button variant="ghost" className="w-full justify-center">
              Keep Exploring
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // REGULAR BOOKING PANEL
  // -------------------------------------------------------------
  const isSelectionComplete = Boolean(bookingDates.startAt && bookingDates.endAt);

  return (
    <div className={cn('bg-card rounded-3xl border border-border p-6 sm:p-7 shadow-warm-md text-ink space-y-6', className)}>
      {/* Unit Price Header */}
      <div className="flex items-baseline justify-between pb-4 border-b border-border">
        <div>
          <Price
            amount={space.priceAmount}
            size="xl"
            period={space.priceUnit?.toLowerCase()}
          />
        </div>
        {space.capacity && (
          <span className="text-xs text-body font-medium flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>Up to {space.capacity} guests</span>
          </span>
        )}
      </div>

      {/* Availability Calendar */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-body block mb-2">
          Select Availability
        </label>
        <AvailabilityCalendar
          priceUnit={space.priceUnit}
          blockedIntervals={blockedIntervals}
          value={bookingDates}
          onChange={(newDates) => setBookingDates(newDates)}
        />
      </div>

      {/* Guest Stepper */}
      <div className="p-3.5 rounded-2xl bg-sand/60 border border-border flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-ink block">Guests</span>
          <span className="text-2xs text-body">
            {space.capacity ? `Maximum ${space.capacity} allowed` : 'No strict limit'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDecrementGuests}
            disabled={guestCount <= 1}
            className="w-8 h-8 rounded-full border border-border bg-card text-ink font-bold hover:bg-sand disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center focus-ring"
            aria-label="Decrease guest count"
          >
            -
          </button>
          <span className="font-semibold text-sm w-4 text-center">{guestCount}</span>
          <button
            type="button"
            onClick={handleIncrementGuests}
            disabled={Boolean(space.capacity && guestCount >= space.capacity)}
            className="w-8 h-8 rounded-full border border-border bg-card text-ink font-bold hover:bg-sand disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center focus-ring"
            aria-label="Increase guest count"
          >
            +
          </button>
        </div>
      </div>

      {/* Live Server Quote Breakdown */}
      <AnimatePresence mode="wait">
        {quoteLoading && (
          <div className="p-4 rounded-2xl bg-sand/40 border border-border flex items-center justify-center gap-2 text-xs text-body">
            <Spinner size="sm" className="text-primary" />
            <span>Calculating authoritative quote...</span>
          </div>
        )}

        {quoteError && !quoteLoading && (
          <div className="p-3.5 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{quoteError}</span>
          </div>
        )}

        {quote && !quoteLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="space-y-3 pt-3 border-t border-border"
          >
            {/* Slot Available Badge */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-body font-medium">Slot status:</span>
              {quote.isAvailable ? (
                <span className="inline-flex items-center gap-1 font-semibold text-success bg-success/10 px-2.5 py-0.5 rounded-lg text-2xs">
                  <CheckCircle2 className="w-3 h-3" /> Available
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-danger bg-danger/10 px-2.5 py-0.5 rounded-lg text-2xs">
                  <AlertCircle className="w-3 h-3" /> Slot Unavailable
                </span>
              )}
            </div>

            {/* Price Line Items */}
            <div className="space-y-2 text-xs text-body pt-1">
              <div className="flex justify-between items-center">
                <span>
                  <Price amount={space.priceAmount} size="sm" showSymbol={true} /> × {quote.pricing?.units} {quote.pricing?.unitLabel}
                </span>
                <Price amount={quote.pricing?.subtotal} size="sm" />
              </div>

              <div className="flex justify-between items-center">
                <span>Taxes</span>
                <Price amount={quote.pricing?.taxAmount} size="sm" />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-border/80 text-sm font-bold text-ink">
                <span>Total Amount</span>
                <Price amount={quote.pricing?.totalAmount} size="md" className="text-primary" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Non-Customer Role Restriction Notice */}
      {isNonCustomerAuth && (
        <div className="p-3.5 rounded-2xl bg-warning/10 border border-warning/30 text-ink text-xs flex items-start gap-2.5" role="alert">
          <ShieldAlert className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <span>
            Only customer accounts can book spaces. You are currently signed in as an <strong>{role}</strong>.
          </span>
        </div>
      )}

      {/* Submission Errors */}
      {submitError && (
        <div className="p-3.5 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-start gap-2.5" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{submitError}</span>
          </div>
        </div>
      )}

      {/* Primary Action Button */}
      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={isNonCustomerAuth || isSubmitting || !isSelectionComplete || (quote && !quote.isAvailable)}
        loading={isSubmitting}
        onClick={handleSubmitBooking}
        className="w-full justify-center shadow-warm-sm"
        rightIcon={!isSubmitting && <ArrowRight className="w-4 h-4" />}
      >
        {!isAuthenticated
          ? 'Sign in to book'
          : isNonCustomerAuth
          ? 'Customer Account Required'
          : !isSelectionComplete
          ? 'Select Dates to Book'
          : 'Request to book'}
      </Button>

      {/* Booking Flow Policy Note */}
      <p className="text-2xs text-body text-center leading-relaxed">
        Request to book: The owner will confirm it, then payment is collected. No charges will occur today.
      </p>
    </div>
  );
}
