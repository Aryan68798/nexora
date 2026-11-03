// Clean explore filters utility without unused imports

/**
 * Formats an integer amount with Indian grouping (e.g., 50000 -> ₹50,000).
 * @param {number|string} val
 * @param {boolean} [showSymbol=true]
 * @returns {string}
 */
export function formatPriceIndian(val, showSymbol = true) {
  if (val === undefined || val === null || val === '') return showSymbol ? '₹0' : '0';
  const num = typeof val === 'number' ? Math.round(val) : Math.round(Number(val) || 0);
  const isNegative = num < 0;
  const absStr = String(Math.abs(num));

  let lastThree = absStr.slice(-3);
  const otherDigits = absStr.slice(0, -3);

  let formatted = lastThree;
  if (otherDigits !== '') {
    const formattedOther = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formatted = `${formattedOther},${lastThree}`;
  }

  const sign = isNegative ? '-' : '';
  const prefix = showSymbol ? '₹' : '';
  return `${sign}${prefix}${formatted}`;
}

/**
 * Formats a price range string with Indian grouping.
 * e.g. (500, 15000) -> "₹500 – ₹15,000"
 */
export function formatPriceRange(min, max) {
  return `${formatPriceIndian(min)} – ${formatPriceIndian(max)}`;
}

/**
 * Default empty explore filter state
 */
export const DEFAULT_EXPLORE_FILTERS = {
  q: '',
  city: '',
  state: '',
  spaceTypes: [],
  priceUnit: '',
  minPrice: '',
  maxPrice: '',
  minCapacity: '',
  sort: 'newest',
  page: 1,
  pageSize: 12,
};

/**
 * Parses URLSearchParams into strongly-typed explore filter state.
 * @param {URLSearchParams|string} search
 * @returns {typeof DEFAULT_EXPLORE_FILTERS}
 */
export function parseExploreFilters(search) {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const filters = { ...DEFAULT_EXPLORE_FILTERS };

  if (params.has('q')) filters.q = params.get('q').trim();
  if (params.has('city')) filters.city = params.get('city').trim();
  if (params.has('state')) filters.state = params.get('state').trim();

  // Multi-select spaceType: supports comma-separated or multiple keys
  const rawSpaceType = params.getAll('spaceType').flatMap((s) => s.split(',')).filter(Boolean);
  if (rawSpaceType.length > 0) {
    filters.spaceTypes = Array.from(new Set(rawSpaceType.map((s) => s.trim().toUpperCase())));
  }

  if (params.has('priceUnit')) {
    const unit = params.get('priceUnit').toUpperCase();
    if (['HOUR', 'DAY'].includes(unit)) filters.priceUnit = unit;
  }

  if (params.has('minPrice') && params.get('minPrice') !== '') {
    const min = Number(params.get('minPrice'));
    if (!isNaN(min) && min >= 0) filters.minPrice = min;
  }

  if (params.has('maxPrice') && params.get('maxPrice') !== '') {
    const max = Number(params.get('maxPrice'));
    if (!isNaN(max) && max >= 0) filters.maxPrice = max;
  }

  if (params.has('minCapacity') && params.get('minCapacity') !== '') {
    const cap = Number(params.get('minCapacity'));
    if (!isNaN(cap) && cap > 0) filters.minCapacity = cap;
  }

  if (params.has('sort')) {
    const sortVal = params.get('sort');
    if (['newest', 'price_asc', 'price_desc', 'rating'].includes(sortVal)) {
      filters.sort = sortVal;
    }
  }

  if (params.has('page')) {
    const pageNum = parseInt(params.get('page'), 10);
    if (!isNaN(pageNum) && pageNum > 0) filters.page = pageNum;
  }

  return filters;
}

/**
 * Serializes explore filters object into a clean query string.
 * Omits empty, default, or null parameters to keep URLs concise and shareable.
 * @param {Object} filters
 * @returns {string}
 */
export function serializeExploreFilters(filters = {}) {
  const params = new URLSearchParams();

  if (filters.q && filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.city && filters.city.trim()) params.set('city', filters.city.trim());
  if (filters.state && filters.state.trim()) params.set('state', filters.state.trim());

  if (Array.isArray(filters.spaceTypes) && filters.spaceTypes.length > 0) {
    params.set('spaceType', filters.spaceTypes.join(','));
  }

  if (filters.priceUnit && ['HOUR', 'DAY'].includes(filters.priceUnit)) {
    params.set('priceUnit', filters.priceUnit);
  }

  if (filters.minPrice !== undefined && filters.minPrice !== null && filters.minPrice !== '') {
    params.set('minPrice', String(filters.minPrice));
  }

  if (filters.maxPrice !== undefined && filters.maxPrice !== null && filters.maxPrice !== '') {
    params.set('maxPrice', String(filters.maxPrice));
  }

  if (filters.minCapacity !== undefined && filters.minCapacity !== null && filters.minCapacity !== '') {
    params.set('minCapacity', String(filters.minCapacity));
  }

  if (filters.sort && filters.sort !== 'newest') {
    params.set('sort', filters.sort);
  }

  if (filters.page && filters.page > 1) {
    params.set('page', String(filters.page));
  }

  const str = params.toString();
  return str ? `?${str}` : '';
}

/**
 * Builds an /explore URL from home search bar criteria.
 * @param {Object} criteria
 * @param {string} [criteria.city]
 * @param {string} [criteria.spaceType]
 * @param {number|string} [criteria.guests]
 * @returns {string}
 */
export function buildSearchQuery({ city, spaceType, guests } = {}) {
  const params = new URLSearchParams();
  if (city && city.trim()) params.set('city', city.trim());
  if (spaceType && spaceType.trim()) params.set('spaceType', spaceType.trim());
  if (guests && Number(guests) > 0) params.set('minCapacity', String(Number(guests)));
  const qStr = params.toString();
  return `/explore${qStr ? `?${qStr}` : ''}`;
}
