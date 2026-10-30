import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  Building2,
  ChevronDown,
  Building,
  Wrench,
  Compass,
} from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { getRoleDashboardPath } from '../../routes/guards';
import { api } from '../../api/client';
import { SpaceCard, SpaceCardSkeleton } from '../../components/spaces/SpaceCard';
import { BottomSheet } from '../../components/native/BottomSheet';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import {
  parseExploreFilters,
  serializeExploreFilters,
  formatPriceIndian,
} from '../../lib/exploreFilters';
import { cn } from '../../lib/utils';

/**
 * Filter Sidebar Controls (shared between Desktop sticky column and Mobile Drawer)
 */
function FilterSidebarContent({
  filters,
  catalogFilters,
  onFilterChange,
  onResetFilters,
}) {
  const cities = catalogFilters?.cities || [];
  const spaceTypes = catalogFilters?.spaceTypes || [
    'ROOM',
    'OFFICE',
    'STUDIO',
    'SHOP',
    'CLASSROOM',
    'PARKING',
    'OTHER',
  ];

  const handleSpaceTypeToggle = (type) => {
    const current = filters.spaceTypes || [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onFilterChange({ spaceTypes: next, page: 1 });
  };

  return (
    <div className="space-y-6">
      {/* City Filter */}
      <div className="space-y-2">
        <label htmlFor="filter-city" className="text-xs font-bold uppercase tracking-wider text-body block">
          Destination City
        </label>
        <div className="relative">
          <select
            id="filter-city"
            value={filters.city || ''}
            onChange={(e) => onFilterChange({ city: e.target.value, page: 1 })}
            className="w-full appearance-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-ink focus-ring cursor-pointer"
          >
            <option value="">All Destinations</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-body absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Space Type Multi-select Chips */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-body block">
            Space Archetypes
          </label>
          {filters.spaceTypes.length > 0 && (
            <button
              type="button"
              onClick={() => onFilterChange({ spaceTypes: [], page: 1 })}
              className="text-2xs text-primary hover:underline"
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {spaceTypes.map((type) => {
            const isSelected = filters.spaceTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleSpaceTypeToggle(type)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all focus-ring select-none',
                  isSelected
                    ? 'bg-primary text-white shadow-warm-xs'
                    : 'bg-sand text-ink border border-border hover:border-primary/50'
                )}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Unit (HOUR / DAY) */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-body block">
          Billing Period
        </label>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-sand border border-border">
          {[
            { label: 'Any', value: '' },
            { label: 'Per Day', value: 'DAY' },
            { label: 'Per Hour', value: 'HOUR' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => onFilterChange({ priceUnit: option.value, page: 1 })}
              className={cn(
                'py-1.5 text-xs font-medium rounded-lg transition-all',
                filters.priceUnit === option.value
                  ? 'bg-card text-ink shadow-warm-xs'
                  : 'text-body hover:text-ink'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range Slider / Inputs */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-body block">
          Price Range (INR)
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-2xs text-body mb-1 block">Min (₹)</span>
            <input
              type="number"
              min="0"
              step="100"
              placeholder="0"
              value={filters.minPrice ?? ''}
              onChange={(e) => onFilterChange({ minPrice: e.target.value ? Number(e.target.value) : '', page: 1 })}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink focus-ring"
            />
          </div>
          <div>
            <span className="text-2xs text-body mb-1 block">Max (₹)</span>
            <input
              type="number"
              min="0"
              step="500"
              placeholder="No limit"
              value={filters.maxPrice ?? ''}
              onChange={(e) => onFilterChange({ maxPrice: e.target.value ? Number(e.target.value) : '', page: 1 })}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink focus-ring"
            />
          </div>
        </div>
        {(filters.minPrice || filters.maxPrice) && (
          <p className="text-2xs text-primary font-medium">
            Filtering: {filters.minPrice ? formatPriceIndian(filters.minPrice) : '₹0'} –{' '}
            {filters.maxPrice ? formatPriceIndian(filters.maxPrice) : 'Unlimited'}
          </p>
        )}
      </div>

      {/* Minimum Capacity */}
      <div className="space-y-2">
        <label htmlFor="filter-capacity" className="text-xs font-bold uppercase tracking-wider text-body block">
          Minimum Capacity
        </label>
        <div className="relative">
          <select
            id="filter-capacity"
            value={filters.minCapacity || ''}
            onChange={(e) => onFilterChange({ minCapacity: e.target.value ? Number(e.target.value) : '', page: 1 })}
            className="w-full appearance-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-ink focus-ring cursor-pointer"
          >
            <option value="">Any capacity</option>
            <option value="1">1+ guests</option>
            <option value="2">2+ guests</option>
            <option value="4">4+ guests</option>
            <option value="8">8+ guests</option>
            <option value="15">15+ guests</option>
          </select>
          <ChevronDown className="w-4 h-4 text-body absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Reset Action */}
      <div className="pt-4 border-t border-border">
        <Button
          variant="secondary"
          size="sm"
          onClick={onResetFilters}
          className="w-full justify-center text-xs"
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
        >
          Reset All Filters
        </Button>
      </div>
    </div>
  );
}

/**
 * Explore Marketplace Page with real-time live filtering, URL synchronization,
 * debounced search, and active filter chip indicators.
 */
export function ExplorePage() {
  const navigate = useNavigate();
  const { isAuthenticated, role, changeRole } = useAuth();
  const [showRolePrompt, setShowRolePrompt] = useState(false);
  const [roleChanging, setRoleChanging] = useState(false);
  const [roleChangeError, setRoleChangeError] = useState(null);

  useEffect(() => {
    const dismissed = localStorage.getItem('nexora:role_prompt_dismissed');
    if (isAuthenticated && role === 'CUSTOMER' && !dismissed) {
      setShowRolePrompt(true);
    } else {
      setShowRolePrompt(false);
    }
  }, [isAuthenticated, role]);

  const handleDismissRolePrompt = () => {
    localStorage.setItem('nexora:role_prompt_dismissed', 'true');
    setShowRolePrompt(false);
  };

  const handleSelectRole = async (targetRole) => {
    if (targetRole === 'CUSTOMER') {
      handleDismissRolePrompt();
      return;
    }
    setRoleChanging(true);
    setRoleChangeError(null);
    try {
      await changeRole(targetRole);
      localStorage.setItem('nexora:role_prompt_dismissed', 'true');
      setShowRolePrompt(false);
      navigate(getRoleDashboardPath(targetRole));
    } catch (err) {
      setRoleChangeError(err.message || 'Failed to update account role');
      setRoleChanging(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Parse filters from URL
  const filters = useMemo(() => parseExploreFilters(searchParams), [searchParams]);

  // Local state for debounced search text input
  const [searchInput, setSearchInput] = useState(filters.q || '');

  // Helper to merge and push updated filter state to URL
  const updateFilters = useCallback((newValues) => {
    const updated = { ...filters, ...newValues };
    const queryStr = serializeExploreFilters(updated);
    setSearchParams(new URLSearchParams(queryStr));
  }, [filters, setSearchParams]);

  // Keep searchInput in sync if URL changes externally
  useEffect(() => {
    setSearchInput(filters.q || '');
  }, [filters.q]);

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.q || '')) {
        updateFilters({ q: searchInput, page: 1 });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, filters.q, updateFilters]);

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  // Fetch catalog filter facets (cities, spaceTypes, priceRange)
  const { data: catalogFilters } = useQuery({
    queryKey: ['catalogFilters'],
    queryFn: () => api.get('/api/catalog/filters'),
    staleTime: 5 * 60 * 1000,
  });

  // Query spaces live from API with keep-previous-data to avoid flicker
  const queryParams = useMemo(() => {
    const p = {
      page: filters.page,
      pageSize: filters.pageSize,
      sort: filters.sort,
    };
    if (filters.q) p.q = filters.q;
    if (filters.city) p.city = filters.city;
    if (filters.state) p.state = filters.state;
    if (filters.spaceTypes.length > 0) p.spaceType = filters.spaceTypes.join(',');
    if (filters.priceUnit) p.priceUnit = filters.priceUnit;
    if (filters.minPrice !== '') p.minPrice = filters.minPrice;
    if (filters.maxPrice !== '') p.maxPrice = filters.maxPrice;
    if (filters.minCapacity !== '') p.minCapacity = filters.minCapacity;
    return p;
  }, [filters]);

  const {
    data: spacesData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['exploreSpaces', queryParams],
    queryFn: () => api.get('/api/spaces', { params: queryParams }),
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000,
  });

  const spaces = Array.isArray(spacesData?.data)
    ? spacesData.data
    : Array.isArray(spacesData)
    ? spacesData
    : [];
  const meta = spacesData?.meta || {
    page: filters.page,
    pageSize: filters.pageSize,
    total: spaces.length,
    totalPages: 1,
  };

  // Count active filter conditions (excluding sort/page)
  const activeChips = useMemo(() => {
    const chips = [];
    if (filters.q) {
      chips.push({ key: 'q', label: `Search: "${filters.q}"`, clear: () => { setSearchInput(''); updateFilters({ q: '', page: 1 }); } });
    }
    if (filters.city) {
      chips.push({ key: 'city', label: `City: ${filters.city}`, clear: () => updateFilters({ city: '', page: 1 }) });
    }
    filters.spaceTypes.forEach((type) => {
      chips.push({
        key: `type-${type}`,
        label: `Archetype: ${type}`,
        clear: () => updateFilters({ spaceTypes: filters.spaceTypes.filter((t) => t !== type), page: 1 }),
      });
    });
    if (filters.priceUnit) {
      chips.push({
        key: 'priceUnit',
        label: filters.priceUnit === 'HOUR' ? 'Hourly Stays' : 'Daily Stays',
        clear: () => updateFilters({ priceUnit: '', page: 1 }),
      });
    }
    if (filters.minPrice || filters.maxPrice) {
      chips.push({
        key: 'priceRange',
        label: `Price: ${filters.minPrice ? formatPriceIndian(filters.minPrice) : '₹0'} – ${filters.maxPrice ? formatPriceIndian(filters.maxPrice) : 'Max'}`,
        clear: () => updateFilters({ minPrice: '', maxPrice: '', page: 1 }),
      });
    }
    if (filters.minCapacity) {
      chips.push({
        key: 'minCapacity',
        label: `Capacity: ${filters.minCapacity}+ guests`,
        clear: () => updateFilters({ minCapacity: '', page: 1 }),
      });
    }
    return chips;
  }, [filters, updateFilters]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
      {/* Page Title & Search Bar Header */}
      <div className="space-y-4">
        <CollapsingTitle
          title="Available Spaces"
          subtitle="Discover rooms, studios, halls and offices for meetings and focused work."
        />

        {/* First-time Google user role prompt card */}
        {showRolePrompt && (
          <div
            data-testid="role-prompt-card"
            className="p-6 sm:p-8 rounded-3xl bg-sand border border-border shadow-warm-sm relative overflow-hidden"
          >
            <button
              type="button"
              onClick={handleDismissRolePrompt}
              className="absolute top-5 right-5 p-2 rounded-xl text-body hover:text-ink hover:bg-border/40 transition-colors"
              aria-label="Dismiss role prompt"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                Welcome to Nexora
              </p>
              <h2 className="font-editorial text-2xl sm:text-3xl font-light text-ink leading-tight">
                How will you use Nexora?
              </h2>
              <p className="text-body text-sm sm:text-base mt-2 leading-relaxed">
                Your account is currently set to Customer. You can browse and book stays, or switch your role now if you manage rental properties or provide specialized maintenance services.
              </p>

              {roleChangeError && (
                <p className="text-xs text-danger mt-2">{roleChangeError}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => handleSelectRole('CUSTOMER')}
                  disabled={roleChanging}
                  className="p-4 rounded-2xl bg-card border border-border hover:border-primary/40 text-left transition-all hover:shadow-warm-xs focus-ring"
                >
                  <div className="w-9 h-9 rounded-xl bg-sand text-ink flex items-center justify-center mb-3">
                    <Compass className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-ink text-sm">Guest & Traveler</h3>
                  <p className="text-body text-xs mt-1">Browse and book work spaces.</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectRole('OWNER')}
                  disabled={roleChanging}
                  className="p-4 rounded-2xl bg-card border border-border hover:border-primary/40 text-left transition-all hover:shadow-warm-xs focus-ring"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <Building className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-ink text-sm">Property Steward</h3>
                  <p className="text-body text-xs mt-1">List spaces, oversee reservations & ledger.</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectRole('PROVIDER')}
                  disabled={roleChanging}
                  className="p-4 rounded-2xl bg-card border border-border hover:border-primary/40 text-left transition-all hover:shadow-warm-xs focus-ring"
                >
                  <div className="w-9 h-9 rounded-xl bg-sand text-ink flex items-center justify-center mb-3">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-ink text-sm">Service Provider</h3>
                  <p className="text-body text-xs mt-1">Join the network for verified maintenance.</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Live Search Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-body absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by space name, description, architectural style, or city..."
              className="w-full pl-12 pr-10 py-3.5 rounded-xl border border-border bg-card text-ink text-sm placeholder:text-body/60 focus-ring shadow-warm-xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateFilters({ q: '', page: 1 });
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-body hover:text-ink"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden min-h-[48px] px-4 rounded-xl border border-border bg-card text-ink text-xs font-semibold flex items-center gap-2 shadow-warm-xs"
          >
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <span>Filters</span>
            {activeChips.length > 0 && (
              <span className="w-5 h-5 rounded-lg bg-primary text-white text-2xs flex items-center justify-center font-bold">
                {activeChips.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        {/* Desktop Sticky Filter Column */}
        <aside className="hidden md:block md:col-span-1 sticky top-28 bg-card rounded-3xl border border-border p-6 shadow-warm-xs">
          <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
            <h2 className="font-editorial text-lg font-normal text-ink flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span>Filters</span>
            </h2>
            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-body hover:text-primary transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <FilterSidebarContent
            filters={filters}
            catalogFilters={catalogFilters}
            onFilterChange={updateFilters}
            onResetFilters={handleResetFilters}
          />
        </aside>

        {/* Results Area */}
        <main className="md:col-span-3 space-y-6">
          {/* Top Bar: Active Chips & Sort Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-body">
              <span>Showing </span>
              <span className="font-semibold text-ink">{meta.total}</span>
              <span> {meta.total === 1 ? 'space' : 'spaces'}</span>
              {isFetching && <span className="ml-2 text-primary text-2xs animate-pulse">• Updating...</span>}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-body whitespace-nowrap">Sort by:</span>
              <div className="relative">
                <select
                  value={filters.sort}
                  onChange={(e) => updateFilters({ sort: e.target.value, page: 1 })}
                  className="appearance-none rounded-xl border border-border bg-card pl-3 pr-8 py-1.5 text-xs font-medium text-ink focus-ring cursor-pointer"
                >
                  <option value="newest">Newest arrivals</option>
                  <option value="rating">Highest rated</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-body absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Active Filter Chips Bar */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sand text-ink text-xs border border-border"
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.clear}
                    className="p-0.5 rounded-lg hover:bg-border/60 text-body hover:text-ink"
                    aria-label={`Remove filter ${chip.label}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-primary hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SpaceCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="p-12 rounded-3xl bg-danger/10 border border-danger/30 text-center space-y-4">
              <p className="font-semibold text-danger">We encountered an error loading the spaces catalog.</p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                Retry Search
              </Button>
            </div>
          )}

          {/* Empty Results State */}
          {!isLoading && !isError && spaces.length === 0 && (
            <div className="p-12 sm:p-16 rounded-3xl bg-sand/60 border border-border text-center space-y-4">
              <div className="w-14 h-14 rounded-xl bg-card border border-border flex items-center justify-center mx-auto text-primary shadow-warm-xs">
                <Building2 className="w-6 h-6 stroke-[1.75]" />
              </div>
              <h3 className="font-serif text-2xl font-semibold text-ink">
                No matching spaces found
              </h3>
              <p className="text-body text-sm max-w-md mx-auto leading-relaxed">
                We couldn&apos;t find any spaces matching your exact combination of filters. Try broadening
                your price range, clearing category chips, or searching a different city.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={handleResetFilters}
                className="mt-2"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Clear All Filters
              </Button>
            </div>
          )}

          {/* Spaces Grid */}
          {!isLoading && !isError && spaces.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {spaces.map((space) => (
                <SpaceCard key={space.id} space={space} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && !isError && meta.totalPages > 1 && (
            <div className="pt-8 border-t border-border flex justify-center">
              <Pagination
                currentPage={meta.page}
                totalPages={meta.totalPages}
                onPageChange={(nextPage) => {
                  updateFilters({ page: nextPage });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Filters BottomSheet (Rule P1 compliant) */}
      <BottomSheet
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        title="Filter Spaces"
      >
        <div className="py-2">
          <FilterSidebarContent
            filters={filters}
            catalogFilters={catalogFilters}
            onFilterChange={updateFilters}
            onResetFilters={handleResetFilters}
          />
          <div className="pt-6 mt-6 border-t border-border">
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={() => setMobileDrawerOpen(false)}
            >
              Show {meta.total} Results
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
