import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Heart,
  Share2,
  Users,
  Building,
  ShieldCheck,
  Star,
  MapPin,
  ChevronRight,
  Info,
} from 'lucide-react';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../features/auth/useAuth';
import { useToast } from '../../components/ui/Toast';
import { Price } from '../../components/ui/Price';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { BottomSheet } from '../../components/native/BottomSheet';
import { EdgeSwipeBack } from '../../components/native/EdgeSwipeBack';
import { Skeleton } from '../../components/ui/Skeleton';
import { SpaceCard } from '../../components/spaces/SpaceCard';
import { SpaceGallery } from '../../components/spaces/SpaceGallery';
import { BookingPanel } from '../../components/spaces/BookingPanel';
import { formatKolkata, cn } from '../../lib/utils';
import { startOfMonth, addMonths, endOfMonth } from 'date-fns';

/**
 * Editorial Space Detail Page
 * Features photo gallery mosaic with lightbox, month availability calendar,
 * live quote calculation, guest login redirect, reviews breakdown, and nearby spaces.
 */
export function SpaceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated, role } = useAuth();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);

  // 1. Fetch space details
  const {
    data: space,
    isLoading: spaceLoading,
    isError: spaceIsError,
    error: spaceError,
    refetch: refetchSpace,
  } = useQuery({
    queryKey: ['space', id],
    queryFn: () => api.get(`/api/spaces/${id}`),
    retry: 1,
  });

  // Dynamic document title
  useEffect(() => {
    if (space?.name) {
      document.title = `${space.name} | Nexora`;
    } else {
      document.title = 'Space | Nexora';
    }
  }, [space?.name]);

  // 2. Fetch availability for current month plus next month (max 62 days)
  const now = useMemo(() => new Date(), []);
  const fromDate = useMemo(() => startOfMonth(now).toISOString(), [now]);
  const toDate = useMemo(() => endOfMonth(addMonths(now, 1)).toISOString(), [now]);

  const {
    data: availability = [],
    refetch: refetchAvailability,
  } = useQuery({
    queryKey: ['space-availability', id, fromDate, toDate],
    queryFn: () => api.get(`/api/spaces/${id}/availability?from=${fromDate}&to=${toDate}`),
    enabled: Boolean(id && space),
  });

  // 3. Fetch reviews
  const {
    data: reviewsResponse,
    isLoading: reviewsLoading,
  } = useQuery({
    queryKey: ['space-reviews', id, reviewsPage],
    queryFn: () => api.get(`/api/spaces/${id}/reviews?page=${reviewsPage}&pageSize=5`),
    enabled: Boolean(id && space),
  });

  const reviews = reviewsResponse?.data || [];
  const reviewsMeta = reviewsResponse?.meta || { total: 0, totalPages: 1 };

  // 4. Fetch more spaces in the same city
  const city = space?.property?.city;
  const {
    data: nearbySpacesResponse,
  } = useQuery({
    queryKey: ['spaces-nearby', city, id],
    queryFn: () => api.get(`/api/spaces?city=${encodeURIComponent(city)}&pageSize=5`),
    enabled: Boolean(city && id),
  });

  const nearbySpaces = useMemo(() => {
    const list = nearbySpacesResponse?.data || [];
    return list.filter((s) => s.id !== id).slice(0, 4);
  }, [nearbySpacesResponse, id]);

  // 5. Favorite toggle handler (with guest redirect)
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  useEffect(() => {
    if (space) {
      setIsFavorite(Boolean(space.isFavorite));
    }
  }, [space]);

  const handleFavoriteToggle = async () => {
    if (!isAuthenticated || role !== 'CUSTOMER') {
      navigate('/login', { state: { from: { pathname: `/spaces/${id}` } } });
      return;
    }

    if (favoriteLoading) return;
    const previous = isFavorite;
    const next = !previous;
    setIsFavorite(next);
    setFavoriteLoading(true);

    try {
      if (next) {
        await api.put(`/api/favorites/${id}`);
        toast.success('Saved to your favorites');
      } else {
        await api.delete(`/api/favorites/${id}`);
        toast.info('Removed from favorites');
      }
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    } catch {
      setIsFavorite(previous);
      toast.error('Unable to update favorite status');
    } finally {
      setFavoriteLoading(false);
    }
  };

  // 6. Share link handler
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  // -----------------------------------------------------------------
  // SKELETON LOADING STATE
  // -----------------------------------------------------------------
  if (spaceLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8 animate-pulse">
        {/* Breadcrumb Skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Title Header Skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3 max-w-lg" />
          <div className="flex gap-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>

        {/* Gallery Mosaic Skeleton */}
        <div className="h-[360px] sm:h-[440px] rounded-3xl bg-sand/60 border border-border" />

        {/* Columns Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-6">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton className="h-96 w-full rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // 404 NOT FOUND STATE
  // -----------------------------------------------------------------
  if (spaceIsError && spaceError instanceof ApiError && spaceError.status === 404) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center text-ink">
        <div className="w-16 h-16 rounded-xl bg-sand border border-border flex items-center justify-center mb-4 text-primary shadow-warm-xs">
          <Building className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h2 className="font-editorial text-3xl font-light text-ink mb-2">
          This space is no longer available
        </h2>
        <p className="text-body text-sm max-w-md mx-auto mb-6 leading-relaxed">
          The space you are looking for has been retired or is currently unavailable for reservations.
        </p>
        <Link to="/explore">
          <Button variant="primary" rightIcon={<ChevronRight className="w-4 h-4" />}>
            Explore Available Spaces
          </Button>
        </Link>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // ERROR STATE WITH RETRY
  // -----------------------------------------------------------------
  if (spaceIsError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center text-ink">
        <div className="p-8 rounded-3xl bg-danger/10 border border-danger/30 max-w-md w-full space-y-4">
          <p className="font-semibold text-danger">We encountered an issue loading this space.</p>
          <p className="text-body text-xs">{spaceError?.message || 'Please check your connection.'}</p>
          <Button variant="secondary" size="sm" onClick={() => refetchSpace()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // MAIN DETAIL PAGE VIEW
  // -----------------------------------------------------------------
  const ownerFirstName = space.property?.owner?.name
    ? space.property.owner.name.trim().split(' ')[0]
    : 'Steward';

  return (
    <EdgeSwipeBack fallbackPath="/explore">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center text-xs sm:text-sm text-body">
        <ol className="flex items-center flex-wrap gap-1.5">
          <li>
            <Link to="/explore" className="hover:text-primary transition-colors focus-ring rounded">
              Explore
            </Link>
          </li>
          <ChevronRight className="w-3.5 h-3.5 text-body/40" />
          <li>
            <Link
              to={`/explore?city=${encodeURIComponent(space.property?.city || '')}`}
              className="hover:text-primary transition-colors focus-ring rounded"
            >
              {space.property?.city}
            </Link>
          </li>
          <ChevronRight className="w-3.5 h-3.5 text-body/40" />
          <li className="font-medium text-ink truncate max-w-[200px] sm:max-w-xs" aria-current="page">
            {space.name}
          </li>
        </ol>
      </nav>

      {/* 2. Space Header: Title, Attributes & Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-border">
        <div className="space-y-3">
          <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-ink tracking-tight">
            {space.name}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-body">
            <span className="flex items-center gap-1 font-medium text-ink">
              <MapPin className="w-4 h-4 text-primary" />
              <span>
                {space.property?.title}, {space.property?.city}, {space.property?.state}
              </span>
            </span>

            <span className="text-border">•</span>

            <Badge variant="secondary" size="sm">
              {space.spaceType}
            </Badge>

            {space.capacity && (
              <>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-body" />
                  <span>{space.capacity} Guests</span>
                </span>
              </>
            )}

            {space.averageRating && (
              <>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1 font-semibold text-ink">
                  <Star className="w-3.5 h-3.5 fill-amber text-amber" />
                  <span>{space.averageRating}</span>
                  <span className="text-body font-normal">({space.reviewCount})</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Favorite & Share Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleShare}
            className="p-2.5 rounded-xl border border-border bg-card text-ink hover:bg-sand transition-colors shadow-warm-xs focus-ring flex items-center gap-1.5 text-xs font-semibold"
            aria-label="Share space link"
          >
            <Share2 className="w-4 h-4 text-body" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            type="button"
            onClick={handleFavoriteToggle}
            disabled={favoriteLoading}
            className={cn(
              'p-2.5 rounded-xl border border-border bg-card transition-all shadow-warm-xs focus-ring flex items-center gap-1.5 text-xs font-semibold',
              isFavorite ? 'text-primary' : 'text-body hover:text-ink hover:bg-sand'
            )}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={cn('w-4 h-4', isFavorite && 'fill-primary text-primary')} />
            <span className="hidden sm:inline">{isFavorite ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* 3. Photo Gallery Mosaic & Lightbox */}
      <SpaceGallery
        media={space.media}
        spaceType={space.spaceType}
        spaceName={space.name}
      />

      {/* 4. Two-Column Main Layout: Left Content & Right Sticky Booking Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column (Editorial details, facts, reviews, nearby) */}
        <div className="lg:col-span-7 space-y-10">
          {/* Fact Icons Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-sand/60 border border-border text-ink">
            <div className="p-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-body block mb-1">
                Archetype
              </span>
              <span className="font-serif font-bold text-sm text-ink">{space.spaceType}</span>
            </div>

            <div className="p-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-body block mb-1">
                Capacity
              </span>
              <span className="font-serif font-bold text-sm text-ink">{space.capacity || 'Flexible'} guests</span>
            </div>

            <div className="p-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-body block mb-1">
                Rate Unit
              </span>
              <span className="font-serif font-bold text-sm text-ink">Per {space.priceUnit}</span>
            </div>

            <div className="p-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-body block mb-1">
                Inspection
              </span>
              <span className="font-serif font-bold text-sm text-success flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified
              </span>
            </div>
          </div>

          {/* About this Space (Description) */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">
              About this space
            </h2>
            <div className="text-body text-sm sm:text-base leading-relaxed whitespace-pre-line font-sans">
              {space.description || 'An architectural space inspected for quiet contemplation and deliberate living.'}
            </div>
          </section>

          {/* Space Guidelines / Rules */}
          {space.rules && (
            <section className="p-6 rounded-3xl bg-sand border border-border space-y-3">
              <h3 className="font-serif font-bold text-ink text-base flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                <span>Space Guidelines</span>
              </h3>
              <p className="text-body text-sm leading-relaxed whitespace-pre-line">
                {space.rules}
              </p>
            </section>
          )}

          {/* Property & Steward Card (Strict Privacy: Owner First Name ONLY) */}
          <section className="p-6 sm:p-7 rounded-3xl bg-card border border-border shadow-warm-xs space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-sand text-ink flex items-center justify-center font-serif text-lg font-bold border border-border">
                {ownerFirstName.charAt(0)}
              </div>
              <div>
                <h3 className="font-serif font-bold text-ink text-base sm:text-lg">
                  Hosted by {ownerFirstName}
                </h3>
                <p className="text-body text-xs">
                  Steward of {space.property?.title} • {space.property?.city}
                </p>
              </div>
            </div>

            <p className="text-body text-xs sm:text-sm leading-relaxed border-t border-border pt-4">
              This property is verified and maintained in accordance with the Nexora Quality Verification Framework.
              Steward coordinates dispatches, turnovers, and routine maintenance.
            </p>
          </section>

          {/* Reviews Section */}
          <section className="space-y-6 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
                  <Star className="w-5 h-5 fill-amber text-amber" />
                  <span>
                    {space.averageRating ? `${space.averageRating} Rating` : 'Reviews'}
                  </span>
                </h2>
                <p className="text-body text-xs sm:text-sm mt-0.5">
                  {space.reviewCount > 0
                    ? `Based on ${space.reviewCount} verified guest ${space.reviewCount === 1 ? 'stay' : 'stays'}`
                    : 'No reviews yet for this newly listed space.'}
                </p>
              </div>
            </div>

            {/* Rating distribution bars (if reviews exist) */}
            {space.reviewCount > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-body p-4 rounded-2xl bg-sand/60 border border-border">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = reviews.filter((r) => r.rating === stars).length;
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="w-8 font-medium text-ink flex items-center gap-0.5">
                        {stars}
                        <Star className="w-3 h-3 fill-amber text-amber inline" />
                      </span>
                      <div className="flex-1 h-2 rounded-xl bg-card overflow-hidden border border-border/50">
                        <div
                          className="h-full bg-amber rounded-xl"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-2xs text-body">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reviews List */}
            {reviewsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="p-8 rounded-3xl bg-sand/50 border border-border text-center space-y-2">
                <p className="font-serif font-bold text-ink">No reviews yet</p>
                <p className="text-body text-xs max-w-sm mx-auto">
                  Be the first guest to review this space.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-5 rounded-2xl bg-card border border-border shadow-warm-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-sand text-ink text-xs font-bold flex items-center justify-center border border-border">
                          {rev.customer?.firstName?.charAt(0) || 'G'}
                        </div>
                        <div>
                          <span className="font-serif font-bold text-ink text-sm block">
                            {rev.customer?.firstName || 'Guest'}
                          </span>
                          <span className="text-2xs text-body">
                            {formatKolkata(rev.createdAt, 'dd MMM yyyy')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-amber text-xs font-semibold">
                        <Star className="w-3.5 h-3.5 fill-amber" />
                        <span>{rev.rating}.0</span>
                      </div>
                    </div>

                    <p className="text-body text-xs sm:text-sm leading-relaxed pt-1">
                      {rev.comment}
                    </p>
                  </div>
                ))}

                {/* Pagination Controls */}
                {reviewsMeta.totalPages > 1 && (
                  <div className="flex justify-between items-center pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={reviewsPage <= 1}
                      onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-body">
                      Page {reviewsMeta.page} of {reviewsMeta.totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={reviewsPage >= reviewsMeta.totalPages}
                      onClick={() => setReviewsPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* More in this city */}
          {nearbySpaces.length > 0 && (
            <section className="space-y-4 pt-6 border-t border-border">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink">
                More in {city}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {nearbySpaces.map((item) => (
                  <SpaceCard key={item.id} space={item} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Sticky Column on Desktop: Booking Panel */}
        <aside className="hidden lg:block lg:col-span-5 sticky top-28">
          <BookingPanel
            space={space}
            blockedIntervals={availability}
            onRefreshAvailability={refetchAvailability}
          />
        </aside>
      </div>

      {/* 5. Mobile Fixed Bottom Bar & Availability Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border p-4 shadow-warm-lg lg:hidden flex items-center justify-between">
        <div>
          <Price
            amount={space.priceAmount}
            size="md"
            period={space.priceUnit?.toLowerCase()}
          />
          <span className="text-2xs text-body block">Verified availability</span>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setMobileDrawerOpen(true)}
          className="shadow-warm-xs"
        >
          Check availability
        </Button>
      </div>

      {/* Mobile BottomSheet with BookingPanel */}
      <BottomSheet
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        title={`Book ${space.name}`}
      >
        <div className="pb-8">
          <BookingPanel
            space={space}
            blockedIntervals={availability}
            onRefreshAvailability={refetchAvailability}
          />
        </div>
      </BottomSheet>
    </div>
  </EdgeSwipeBack>
  );
}
