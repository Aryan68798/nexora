import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  MapPin,
  Users,
  Star,
  ChevronDown,
  Search,
  Heart,
  RefreshCw,
  Plus,
  Minus,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../api/client';
import { CountUp } from '../components/ui/CountUp';
import { Button } from '../components/ui/Button';
import { Price } from '../components/ui/Price';
import { PlaceholderImage } from '../components/ui/PlaceholderImage';
import { useAuth } from '../features/auth/useAuth';
import { resolvePostLoginPath } from '../lib/postLoginRedirect';
import { useToast } from '../components/ui/Toast';
import {
  Reveal,
  useSentinel,
  useHeaderScrollShadow,
  heroHeadlineVariants,
  heroLineVariants,
  listRowVariants,
} from '../lib/scrollMotion';
import { useMotionPreference } from '../lib/motion';
import { cn } from '../lib/utils';

/**
 * Oliver Smith Hero Architectural Image Container with 12px rounded rectangle
 * and plain sand "No photo yet" fallback on error.
 */
function HeroPhoto() {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="relative w-full aspect-[16/9] sm:aspect-[2.2/1] rounded-xl overflow-hidden shadow-warm-md border border-border bg-sand">
      {!imageError ? (
        <img
          src="/images/hero.jpg"
          alt="Spaces for meetings, halls and offices"
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-sand">
          <span className="font-editorial text-2xl text-body font-light">No photo yet</span>
        </div>
      )}
    </div>
  );
}

/**
 * Oliver Smith 3-Column Space Card.
 * Clean rectangular photo, top-left status badge, bold price and specs,
 * rating only when reviews exist, favorite toggle for customers.
 */
function SpaceGridCard({ space, index }) {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const { toast } = useToast();
  const [isFavorite, setIsFavorite] = useState(Boolean(space?.isFavorite));
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { isReducedMotion } = useMotionPreference();

  const city = space?.property?.city || space?.city || '';
  const state = space?.property?.state || space?.state || '';
  const locationLabel = [city, state].filter(Boolean).join(', ');

  const handleFavoriteClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated || role !== 'CUSTOMER') {
      navigate('/login?role=customer');
      return;
    }

    if (isUpdatingFavorite) return;

    const previousState = isFavorite;
    const nextState = !previousState;
    setIsFavorite(nextState);
    setIsUpdatingFavorite(true);

    try {
      if (nextState) {
        await api.put(`/api/favorites/${space.id}`);
        toast.success(`Saved "${space.name}" to favorites`);
      } else {
        await api.delete(`/api/favorites/${space.id}`);
        toast.show(`Removed "${space.name}" from favorites`);
      }
    } catch {
      setIsFavorite(previousState);
      toast.error('Failed to update favorite');
    } finally {
      setIsUpdatingFavorite(false);
    }
  };

  const cardContent = (
    <div className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden shadow-warm-xs hover:shadow-warm-md transition-all duration-300">
      {/* 4:3 Image Container */}
      <div
        className="w-full shrink-0 overflow-hidden bg-sand relative"
        style={{ aspectRatio: '4/3' }}
      >
        {space.coverImageUrl ? (
          <img
            src={space.coverImageUrl}
            alt={space.name}
            onLoad={() => setImageLoaded(true)}
            className={cn(
              'w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-105',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            loading="lazy"
          />
        ) : (
          <PlaceholderImage
            spaceType={space.spaceType}
            title={space.name}
            className="w-full h-full"
            aspectRatio="4/3"
          />
        )}

        {/* Floating status tag top-left */}
        <div className="absolute top-3 left-3 pointer-events-none">
          <span className="px-2.5 py-1 rounded bg-card/95 border border-border/80 text-[11px] font-mono tracking-wider text-ink shadow-warm-xs uppercase">
            For Booking
          </span>
        </div>

        {/* Favorite Heart for Customers (hidden for owners, providers, admins) */}
        {(!isAuthenticated || role === 'CUSTOMER') && (
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
            className={cn(
              'absolute top-3 right-3 p-2 rounded-lg transition-all shadow-warm-xs focus-ring',
              isFavorite
                ? 'bg-card text-primary'
                : 'bg-card/90 text-body hover:text-primary hover:bg-card'
            )}
          >
            <Heart
              className={cn(
                'w-4 h-4',
                isFavorite ? 'fill-primary stroke-primary' : 'stroke-current'
              )}
            />
          </button>
        )}
      </div>

      {/* Details Box */}
      <div className="p-5 flex flex-col justify-between flex-1">
        <div className="space-y-2">
          {/* Location and Space Type */}
          <div className="flex items-center gap-2 text-xs text-body flex-wrap">
            {locationLabel && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate max-w-[140px]">{locationLabel}</span>
              </span>
            )}
            {space.spaceType && (
              <>
                {locationLabel && <span className="text-border">·</span>}
                <span className="font-medium text-ink/75">
                  {space.spaceType.charAt(0) + space.spaceType.slice(1).toLowerCase()}
                </span>
              </>
            )}
          </div>

          {/* Name */}
          <Link
            to={`/spaces/${space.id}`}
            className="block focus-ring rounded"
          >
            <h3 className="font-serif text-lg sm:text-xl font-semibold text-ink line-clamp-1 group-hover:text-primary transition-colors">
              {space.name}
            </h3>
          </Link>

          {/* Capacity */}
          {space.capacity && (
            <p className="text-xs text-body flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-body shrink-0" />
              <span>Up to {space.capacity} guests</span>
            </p>
          )}
        </div>

        {/* Bottom Specs & Price Row */}
        <div className="mt-4 pt-3 border-t border-border flex items-baseline justify-between flex-wrap gap-2">
          {/* Review rating (only shown when reviews exist, matching tests) */}
          <div>
            {space.reviewCount > 0 ? (
              <div className="flex items-center gap-1 text-xs font-medium text-ink">
                <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                <span>{Number(space.averageRating || 0).toFixed(1)}</span>
                <span className="text-body font-normal">({space.reviewCount})</span>
              </div>
            ) : (
              <span className="text-xs text-body font-mono">Verified Space</span>
            )}
          </div>

          {/* Price */}
          <Price
            amount={space.priceAmount}
            period={space.priceUnit ? space.priceUnit.toLowerCase() : 'day'}
            size="sm"
          />
        </div>
      </div>
    </div>
  );

  if (isReducedMotion) {
    return <div key={space.id}>{cardContent}</div>;
  }

  return (
    <motion.div
      key={space.id}
      variants={listRowVariants}
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
    >
      {cardContent}
    </motion.div>
  );
}

/**
 * Editorial Landing Page in Oliver Smith Framer UI Style
 * - Hero with architectural photo, location tag, and floating concierge card
 * - 3-column Sign In section with clean rules
 * - Real API facts line
 * - Recent Listings 3-column grid (#spaces) with infinite scroll
 * - Dark "About Nexora" brand showcase
 * - "How Nexora works" 3-step numbered split
 * - "Areas We Serve" locations grid
 * - Customer & owner reviews
 * - Accordion FAQs
 * - Call to action banner
 */
export function LandingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isScrolled = useHeaderScrollShadow(40);
  const { isReducedMotion } = useMotionPreference();
  const { isAuthenticated, profile, loading: authLoading, signOut } = useAuth();
  const queryClient = useQueryClient();

  const firstName = profile?.name ? profile.name.trim().split(' ')[0] : 'Member';

  const handleSignOut = async () => {
    await signOut();
    queryClient.clear();
    navigate('/', { replace: true });
  };

  // Active filter state synced with searchParams
  const cityFilter = searchParams.get('city') || '';
  const spaceTypeFilter = searchParams.get('spaceType') || '';
  const qFilter = searchParams.get('q') || '';

  // Local text input state for search box
  const [searchInput, setSearchInput] = useState(qFilter);

  useEffect(() => {
    setSearchInput(qFilter);
  }, [qFilter]);

  // Query catalog filters for dropdowns
  const { data: catalogFilters } = useQuery({
    queryKey: ['catalogFilters'],
    queryFn: () => api.get('/api/catalog/filters'),
    staleTime: 5 * 60 * 1000,
  });

  // Query space count for real facts
  const { data: spacesCountData } = useQuery({
    queryKey: ['spacesCount'],
    queryFn: () => api.get('/api/spaces', { params: { pageSize: 1 } }),
    staleTime: 5 * 60 * 1000,
  });

  // Infinite query for listings (6 per page)
  const {
    data: infiniteSpacesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: spacesLoading,
    isError: spacesError,
    error: spacesErrorObj,
    refetch: refetchSpaces,
  } = useInfiniteQuery({
    queryKey: ['infiniteSpaces', { city: cityFilter, spaceType: spaceTypeFilter, q: qFilter }],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/api/spaces', {
        params: {
          page: pageParam,
          pageSize: 6,
          city: cityFilter || undefined,
          spaceType: spaceTypeFilter || undefined,
          q: qFilter || undefined,
        },
      }),
    getNextPageParam: (lastPage) => {
      const meta = lastPage?.meta;
      if (meta && meta.page < meta.totalPages) {
        return meta.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    staleTime: 60 * 1000,
  });

  // Flatten spaces from pages
  const allSpaces =
    infiniteSpacesData?.pages?.flatMap((page) => {
      if (Array.isArray(page?.data)) return page.data;
      if (Array.isArray(page)) return page;
      return [];
    }) || [];

  // Sentinel element for infinite scroll
  const sentinelRef = useSentinel({
    onIntersect: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    enabled: Boolean(hasNextPage),
    rootMargin: '400px',
  });

  // Filter updates
  const handleCityChange = (e) => {
    const nextCity = e.target.value;
    const nextParams = new URLSearchParams(searchParams);
    if (nextCity) {
      nextParams.set('city', nextCity);
    } else {
      nextParams.delete('city');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleSpaceTypeChange = (e) => {
    const nextType = e.target.value;
    const nextParams = new URLSearchParams(searchParams);
    if (nextType) {
      nextParams.set('spaceType', nextType);
    } else {
      nextParams.delete('spaceType');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const nextParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      nextParams.set('q', searchInput.trim());
    } else {
      nextParams.delete('q');
    }
    setSearchParams(nextParams, { replace: true });
  };

  // Facts numbers strictly from real API responses
  const totalSpaces = spacesCountData?.meta?.total ?? null;
  const rawFilters = catalogFilters?.data || catalogFilters || {};
  const availableCities = Array.isArray(rawFilters?.cities) ? rawFilters.cities : [];
  const availableTypes = Array.isArray(rawFilters?.spaceTypes) ? rawFilters.spaceTypes : [];
  const citiesCount = availableCities.length > 0 ? availableCities.length : null;
  const spaceTypesCount = availableTypes.length > 0 ? availableTypes.length : null;

  // FAQ open/close state
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const faqItems = [
    {
      question: 'What types of workspaces can I book on Nexora?',
      answer:
        'You can book meeting rooms, podcast and media studios, private executive offices, flex desk memberships, and large presentation halls across major Indian business centers.',
    },
    {
      question: 'How do I get started with scheduling or reserving a space?',
      answer:
        'Select your preferred city, space type, or capacity above. Review photos, amenities, and hourly or monthly rates, then complete your booking with transparent pricing and standard terms.',
    },
    {
      question: 'What is included when an owner lists a property on Nexora?',
      answer:
        'Every listing includes professional catalog presentation, verified space details, transparent calendar management, and direct coordination with certified service providers for ongoing facility upkeep.',
    },
    {
      question: 'Do you offer virtual walkthroughs or advance inspections?',
      answer:
        'Yes. All spaces feature high-resolution photos, verified floor dimensions, and detailed amenity lists. Property owners also record digital inspection notes for condition verification.',
    },
    {
      question: 'How do payments, taxes, and invoices work?',
      answer:
        'All prices are displayed in Indian Rupees (INR) with complete tax and fee breakdowns before confirmation. Invoices are stored permanently in your account dashboard for simple accounting.',
    },
  ];

  return (
    <div className="space-y-20 md:space-y-28 pb-24">
      {/* 1. OLIVER SMITH HERO SECTION */}
      <section className="relative bg-sand pt-12 md:pt-16 pb-16 md:pb-20 overflow-hidden border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Location Bar */}
          <div className="flex items-center justify-between mb-8">
            <div className="inline-flex items-center gap-2 py-1 px-3 rounded-lg bg-card border border-border text-xs font-mono text-ink shadow-warm-xs">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>Bangalore · Mumbai · Delhi · Austin</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-body uppercase tracking-wider">
              <span>Verified Real Estate &amp; Spaces</span>
            </div>
          </div>

          {/* Main Headline & Subtitle */}
          <div className="mb-10 text-left">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 bg-primary shrink-0" />
              <span className="text-xs font-mono tracking-widest text-primary font-semibold uppercase">
                PREMIUM SPACES
              </span>
            </div>

            {isReducedMotion ? (
              <div>
                <h1 className="font-editorial text-4xl sm:text-6xl lg:text-7xl font-light text-ink tracking-tight leading-[1.04] mb-4 max-w-4xl">
                  Rooms, halls and offices you can book.
                </h1>
                <p className="text-body text-base sm:text-lg max-w-2xl leading-relaxed">
                  Work and meeting spaces across India with transparent pricing and verified details.
                </p>
              </div>
            ) : (
              <motion.div variants={heroHeadlineVariants} initial="hidden" animate="visible">
                <motion.h1
                  variants={heroLineVariants}
                  className="font-editorial text-4xl sm:text-6xl lg:text-7xl font-light text-ink tracking-tight leading-[1.04] mb-4 max-w-4xl"
                >
                  Rooms, halls and offices you can book.
                </motion.h1>
                <motion.p
                  variants={heroLineVariants}
                  className="text-body text-base sm:text-lg max-w-2xl leading-relaxed"
                >
                  Work and meeting spaces across India with transparent pricing and verified details.
                </motion.p>
              </motion.div>
            )}
          </div>

          {/* Hero Visual Container with Bottom-Right Floating Concierge Card */}
          <div className="relative">
            <HeroPhoto />

            {/* Oliver Smith Signature Floating Concierge Box */}
            <div className="mt-4 sm:mt-0 sm:absolute sm:bottom-6 sm:right-6 w-full sm:w-80 bg-card border border-border p-4 rounded-xl shadow-warm-md text-left z-10">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="/images/spaces/loft-industrial.jpg"
                  alt="Nexora concierge"
                  className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border"
                />
                <div className="min-w-0">
                  <p className="text-primary font-mono font-bold tracking-wider uppercase text-[10px]">
                    Nexora Concierge
                  </p>
                  <p className="text-ink font-semibold text-xs leading-snug truncate">
                    Simple, clear property bookings
                  </p>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <a
                  href="#spaces"
                  className="w-full py-2.5 px-3.5 bg-primary hover:bg-primary-hover text-white font-medium text-xs tracking-wider uppercase rounded-lg flex items-center justify-between transition-colors focus-ring"
                >
                  <span>Browse Spaces</span>
                  <span className="text-sm">↗</span>
                </a>
              </div>
            </div>
          </div>

          {/* Scroll hint chevron that fades out on scroll */}
          <div
            className={cn(
              'mt-10 flex flex-col items-center justify-center transition-opacity duration-300',
              isScrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'
            )}
            aria-hidden="true"
          >
            <ChevronDown className="w-5 h-5 text-body animate-bounce" />
          </div>
        </div>
      </section>

      {/* 2. SIGN IN OR LOGGED-IN DASHBOARD SECTION */}
      {authLoading ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="min-h-[280px] rounded-xl bg-sand/60 border border-border" />
        </div>
      ) : isAuthenticated ? (
        <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-10 rounded-xl bg-sand border border-border flex flex-col sm:flex-row items-center justify-between gap-6 shadow-warm-xs">
            <div className="text-center sm:text-left">
              <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                <div className="w-2 h-2 bg-primary" />
                <span className="text-xs font-mono tracking-widest text-primary uppercase font-semibold">
                  ACTIVE SESSION
                </span>
              </div>
              <h2 className="font-editorial text-2xl sm:text-3xl font-light text-ink">
                Signed in as {firstName}
              </h2>
              <p className="text-body text-sm mt-1">
                Access your reservations, manage listings, or track assignments.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link to={resolvePostLoginPath(profile)}>
                <Button variant="primary">Go to my dashboard</Button>
              </Link>
              <Button variant="ghost" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 bg-primary" />
              <span className="text-xs font-mono tracking-widest text-primary font-semibold uppercase">
                ACCESS &amp; ACCOUNTS
              </span>
            </div>
            <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-ink tracking-tight mb-3">
              Sign in or create an account
            </h2>
            <p className="text-body text-sm sm:text-base max-w-md mx-auto">
              Choose how you use Nexora to access your reservations or manage properties.
            </p>
          </div>

          {/* 3 Columns separated by thin rules in Oliver Smith partition layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border border-y border-border py-8 bg-card rounded-xl shadow-warm-xs">
            {/* Column 1: Customer */}
            <div className="py-6 md:py-4 md:px-8 first:pt-4 md:first:pl-8 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-primary uppercase font-bold">
                  01 / BOOKING
                </span>
                <h3 className="font-editorial text-2xl font-light text-ink mt-1 mb-2">
                  Customer
                </h3>
                <p className="text-body text-sm leading-relaxed mb-6">
                  Find, compare and book spaces for meetings, creative projects and quiet desk work.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/login?role=customer" className="flex-1">
                  <Button variant="secondary" className="w-full justify-center">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup?role=customer" className="flex-1">
                  <Button variant="primary" className="w-full justify-center">
                    Create account
                  </Button>
                </Link>
              </div>
            </div>

            {/* Column 2: Owner */}
            <div className="py-6 md:py-4 md:px-8 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-primary uppercase font-bold">
                  02 / LISTING
                </span>
                <h3 className="font-editorial text-2xl font-light text-ink mt-1 mb-2">
                  Owner
                </h3>
                <p className="text-body text-sm leading-relaxed mb-6">
                  List properties, review booking requests, and manage property maintenance.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/login?role=owner" className="flex-1">
                  <Button variant="secondary" className="w-full justify-center">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup?role=owner" className="flex-1">
                  <Button variant="primary" className="w-full justify-center">
                    Create account
                  </Button>
                </Link>
              </div>
            </div>

            {/* Column 3: Service provider */}
            <div className="py-6 md:py-4 md:px-8 last:pb-4 md:last:pr-8 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-primary uppercase font-bold">
                  03 / MAINTENANCE
                </span>
                <h3 className="font-editorial text-2xl font-light text-ink mt-1 mb-2">
                  Service provider
                </h3>
                <p className="text-body text-sm leading-relaxed mb-6">
                  Receive maintenance assignments for plumbing, electrical and carpentry.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/login?role=provider" className="flex-1">
                  <Button variant="secondary" className="w-full justify-center">
                    Log in
                  </Button>
                </Link>
                <Link to="/signup?role=provider" className="flex-1">
                  <Button variant="primary" className="w-full justify-center">
                    Create account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* 3. FACTS LINE: real API numbers strictly matching tests */}
      {(totalSpaces !== null || citiesCount !== null || spaceTypesCount !== null) && (
        <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-t border-b border-border py-8 bg-sand/40 rounded-xl">
            <dl className="flex flex-wrap items-center justify-around gap-x-12 gap-y-6 text-center">
              {totalSpaces !== null && (
                <div className="flex flex-col items-center gap-1">
                  <dt className="text-xs uppercase tracking-wider font-semibold text-body order-2">
                    Available spaces
                  </dt>
                  <dd className="font-editorial text-4xl sm:text-5xl font-light text-ink order-1">
                    <CountUp end={totalSpaces} />
                  </dd>
                </div>
              )}
              {citiesCount !== null && (
                <div className="flex flex-col items-center gap-1">
                  <dt className="text-xs uppercase tracking-wider font-semibold text-body order-2">
                    Cities
                  </dt>
                  <dd className="font-editorial text-4xl sm:text-5xl font-light text-ink order-1">
                    <CountUp end={citiesCount} />
                  </dd>
                </div>
              )}
              {spaceTypesCount !== null && (
                <div className="flex flex-col items-center gap-1">
                  <dt className="text-xs uppercase tracking-wider font-semibold text-body order-2">
                    Space types
                  </dt>
                  <dd className="font-editorial text-4xl sm:text-5xl font-light text-ink order-1">
                    <CountUp end={spaceTypesCount} />
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </Reveal>
      )}

      {/* 4. OLIVER SMITH 3-COLUMN RECENT LISTINGS GRID (id="spaces") */}
      <section id="spaces" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 bg-primary" />
            <span className="text-xs font-mono tracking-widest text-primary font-semibold uppercase">
              PROPERTIES
            </span>
          </div>
          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-ink tracking-tight mb-2">
            Available spaces
          </h2>
          <p className="text-body text-sm sm:text-base">
            Browse selected properties that match diverse needs and budgets.
          </p>
        </div>

        {/* Minimalist Filter Row */}
        <div className="bg-sand border border-border rounded-xl p-3 sm:p-4 mb-8">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col md:flex-row items-stretch md:items-center gap-3"
          >
            {/* City Select */}
            <div className="flex-1 min-w-[160px]">
              <label htmlFor="filter-city" className="sr-only">
                City
              </label>
              <select
                id="filter-city"
                value={cityFilter}
                onChange={handleCityChange}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink focus-ring"
              >
                <option value="">All cities</option>
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Space Type Select */}
            <div className="flex-1 min-w-[160px]">
              <label htmlFor="filter-space-type" className="sr-only">
                Space Type
              </label>
              <select
                id="filter-space-type"
                value={spaceTypeFilter}
                onChange={handleSpaceTypeChange}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink focus-ring"
              >
                <option value="">All types</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Keyword Search Input */}
            <div className="flex-[1.5] relative">
              <label htmlFor="filter-search" className="sr-only">
                Search spaces
              </label>
              <input
                id="filter-search"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or keyword"
                className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-ink placeholder:text-body focus-ring"
              />
              <Search className="w-4 h-4 text-body absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <Button type="submit" variant="primary" size="md">
              Filter
            </Button>
          </form>
        </div>

        {/* Loading Initial State */}
        {spacesLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div
                  className="w-full rounded-lg bg-sand skeleton-shimmer"
                  style={{ aspectRatio: '4/3' }}
                />
                <div className="space-y-2">
                  <div className="h-4 w-1/3 bg-sand rounded skeleton-shimmer" />
                  <div className="h-6 w-3/4 bg-sand rounded skeleton-shimmer" />
                  <div className="h-4 w-1/2 bg-sand rounded skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State with Retry */}
        {spacesError && (
          <div className="p-8 rounded-xl bg-sand border border-border text-center space-y-3 my-6">
            <p className="font-semibold text-ink">
              {spacesErrorObj?.message || 'Unable to load spaces at this time.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetchSpaces()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!spacesLoading && !spacesError && allSpaces.length === 0 && (
          <div className="p-12 rounded-xl bg-sand border border-border text-center space-y-2 my-6">
            <p className="font-serif text-xl font-semibold text-ink">
              No spaces match your filters
            </p>
            <p className="text-body text-sm">
              Try selecting a different city or clearing the search terms.
            </p>
          </div>
        )}

        {/* Oliver Smith 3-Column Responsive Grid */}
        {!spacesLoading && !spacesError && allSpaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {allSpaces.map((space, index) => (
              <SpaceGridCard key={space.id} space={space} index={index} />
            ))}
          </div>
        )}

        {/* Sentinel element for infinite scroll */}
        <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />

        {/* Loading More Indicator & Fallback Load More Button */}
        <div className="mt-12 flex flex-col items-center justify-center gap-3">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-body">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Loading more spaces...</span>
            </div>
          )}

          {hasNextPage && !isFetchingNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              className="py-3 px-8 bg-card border border-border hover:bg-border text-ink font-medium text-xs tracking-wider uppercase rounded-lg transition-colors focus-ring shadow-warm-xs"
            >
              Load more
            </button>
          )}

          {!hasNextPage && allSpaces.length > 0 && (
            <p className="text-xs font-mono font-medium text-body uppercase tracking-wider">
              That is every available space
            </p>
          )}
        </div>
      </section>

      {/* 5. OLIVER SMITH DARK "ABOUT NEXORA" SHOWCASE BLOCK */}
      <section className="bg-sand text-ink py-16 md:py-24 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 bg-primary" />
                  <span className="text-xs font-mono tracking-widest text-primary uppercase font-bold">
                    ABOUT NEXORA
                  </span>
                </div>
                <h3 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-white tracking-tight leading-tight">
                  Offering Dedicated Space Booking &amp; Property Management Tailored to Elegant and Productive Work.
                </h3>
              </div>

              <div>
                <a
                  href="#spaces"
                  className="inline-flex items-center gap-2 py-3 px-6 bg-primary hover:bg-primary-hover text-white text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors focus-ring shadow-warm-xs"
                >
                  <span>Explore All Spaces</span>
                  <span>↗</span>
                </a>
              </div>

              {/* Stat Counters with Hairline Dividers */}
              <div className="grid grid-cols-3 border-t border-border pt-8 gap-4">
                <div className="border-r border-border pr-4">
                  <p className="font-editorial text-3xl sm:text-4xl font-light text-white">10+</p>
                  <p className="text-xs text-body font-mono mt-1">Years Experience</p>
                </div>
                <div className="border-r border-border px-4">
                  <p className="font-editorial text-3xl sm:text-4xl font-light text-white">250+</p>
                  <p className="text-xs text-body font-mono mt-1">Managed Spaces</p>
                </div>
                <div className="pl-4">
                  <p className="font-editorial text-3xl sm:text-4xl font-light text-white">99%</p>
                  <p className="text-xs text-body font-mono mt-1">Client Satisfaction</p>
                </div>
              </div>
            </div>

            {/* Right Architectural Image */}
            <div className="relative rounded-xl overflow-hidden border border-border aspect-[4/3] bg-card">
              <img
                src="/images/properties/villa-pool.jpg"
                alt="Nexora architecture"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 py-1 px-3 bg-black/85 rounded text-[11px] font-mono tracking-wider text-white uppercase border border-border">
                Nexora Signature Property
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. HOW NEXORA WORKS: Numbered list (01, 02, 03) */}
      <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Side: Photo */}
          <div className="rounded-xl overflow-hidden border border-border aspect-[4/3] bg-sand">
            <img
              src="/images/properties/estate-brick.jpg"
              alt="Nexora workspace booking"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Right Side: Numbered Steps */}
          <div>
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 bg-primary" />
                <span className="text-xs font-mono tracking-widest text-primary font-semibold uppercase">
                  HOW IT WORKS
                </span>
              </div>
              <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-ink tracking-tight mb-2">
                How Nexora works
              </h2>
              <p className="text-body text-sm sm:text-base">
                Three steps from discovery to confirmed reservation.
              </p>
            </div>

            <div className="divide-y divide-border border-t border-border">
              {/* Step 1 */}
              <div className="flex gap-6 py-6">
                <span className="font-editorial text-4xl sm:text-5xl font-light text-primary/60 leading-none shrink-0 select-none w-12 text-right">
                  01
                </span>
                <div className="pt-0.5">
                  <h3 className="font-serif text-lg sm:text-xl font-semibold text-ink mb-1">
                    Search and compare
                  </h3>
                  <p className="text-body text-sm leading-relaxed">
                    Filter rooms by city, capacity, space type, and price unit. Check availability across current and upcoming months.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-6 py-6">
                <span className="font-editorial text-4xl sm:text-5xl font-light text-primary/60 leading-none shrink-0 select-none w-12 text-right">
                  02
                </span>
                <div className="pt-0.5">
                  <h3 className="font-serif text-lg sm:text-xl font-semibold text-ink mb-1">
                    Get a quote and book
                  </h3>
                  <p className="text-body text-sm leading-relaxed">
                    Receive itemized price breakdowns with tax and subtotal. Submit reservations with standard cancellation policies.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-6 py-6">
                <span className="font-editorial text-4xl sm:text-5xl font-light text-primary/60 leading-none shrink-0 select-none w-12 text-right">
                  03
                </span>
                <div className="pt-0.5">
                  <h3 className="font-serif text-lg sm:text-xl font-semibold text-ink mb-1">
                    On-site support
                  </h3>
                  <p className="text-body text-sm leading-relaxed">
                    Owners coordinate maintenance directly with certified plumbers, carpenters, and electricians for timely repairs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* 7. AREAS WE SERVE (Locations Grid) */}
      <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 bg-primary" />
            <span className="text-xs font-mono tracking-widest text-primary font-semibold uppercase">
              LOCATIONS
            </span>
          </div>
          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-ink tracking-tight mb-2">
            Areas We Serve
          </h2>
          <p className="text-body text-sm sm:text-base">
            Proudly serving premier business hubs and tech districts across India.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {[
            { city: 'Indiranagar', state: 'Bangalore' },
            { city: 'Bandra West', state: 'Mumbai' },
            { city: 'Connaught Place', state: 'New Delhi' },
            { city: 'Hitec City', state: 'Hyderabad' },
            { city: 'Koramangala', state: 'Bangalore' },
            { city: 'Cyber City', state: 'Gurgaon' },
          ].map((loc) => (
            <div
              key={loc.city}
              className="p-4 rounded-xl bg-card border border-border shadow-warm-xs flex flex-col justify-between"
            >
              <MapPin className="w-4 h-4 text-primary mb-3" />
              <div>
                <p className="text-sm font-semibold text-ink">{loc.city}</p>
                <p className="text-xs text-body font-mono mt-0.5">{loc.state}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* 8. COMMUNITY REVIEWS ("What Space Owners & Guests Are Saying") */}
      <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 bg-primary" />
            <span className="text-xs font-mono tracking-widest text-primary font-semibold uppercase">
              COMMUNITY VOICE
            </span>
          </div>
          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-ink tracking-tight mb-2">
            What Space Owners &amp; Guests Are Saying
          </h2>
          <p className="text-body text-sm sm:text-base">
            Verified feedback from over 80+ space owners and booking members.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              quote:
                'Booking our quarterly team offsite through Nexora was completely straightforward. Pricing was clear upfront and the facility was immaculate.',
              author: 'Daniel R.',
              role: 'Product Lead, Bangalore',
            },
            {
              quote:
                'As an office property owner, managing reservations and maintenance requests in one dashboard has saved our staff hours every week.',
              author: 'Kelvin O.',
              role: 'Property Steward, Mumbai',
            },
            {
              quote:
                'The audio suite was soundproof, equipped exactly as described, and ready when we arrived. Reliable and professional booking.',
              author: 'Sarah M.',
              role: 'Creative Director, Delhi',
            },
          ].map((rev) => (
            <div
              key={rev.author}
              className="p-6 rounded-xl bg-card border border-border shadow-warm-xs flex flex-col justify-between"
            >
              <div>
                {/* 5 Stars */}
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-3.5 h-3.5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-ink leading-relaxed mb-6 font-normal">
                  "{rev.quote}"
                </p>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink">{rev.author}</p>
                  <p className="text-[11px] text-body font-mono">{rev.role}</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* 9. ACCORDION FAQS */}
      <Reveal className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 bg-primary" />
            <span className="text-xs font-mono tracking-widest text-primary font-semibold uppercase">
              FAQS
            </span>
          </div>
          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-ink tracking-tight mb-2">
            Your Questions, Answered
          </h2>
          <p className="text-body text-sm sm:text-base">
            Clear information about reservation terms, amenities, and property listing.
          </p>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {faqItems.map((item, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={item.question} className="py-5">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                  className="w-full flex items-center justify-between text-left gap-4 focus-ring rounded py-1"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-semibold text-ink">
                    {item.question}
                  </span>
                  <span className="shrink-0 text-primary p-1 rounded-lg border border-border bg-sand">
                    {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </span>
                </button>
                {isOpen && (
                  <p className="mt-3 text-sm text-body leading-relaxed max-w-2xl">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Reveal>

      {/* 10. CALL TO ACTION BANNER */}
      <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-sand border border-border text-white p-8 sm:p-12 md:p-16 flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-warm-md">
          <div className="max-w-xl">
            <span className="text-xs font-mono tracking-widest text-primary uppercase font-bold">
              GET STARTED
            </span>
            <h3 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-white tracking-tight mt-2 mb-3">
              Ready to find your ideal workspace?
            </h3>
            <p className="text-white/70 text-sm sm:text-base leading-relaxed">
              Explore meeting rooms, creative studios, and office suites with live availability.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <a
              href="#spaces"
              className="w-full sm:w-auto py-3.5 px-6 bg-primary hover:bg-primary-hover text-white text-xs font-semibold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-colors focus-ring"
            >
              <span>Browse Spaces</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
