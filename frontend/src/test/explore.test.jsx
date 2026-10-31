import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  parseExploreFilters,
  serializeExploreFilters,
  formatPriceIndian,
  formatPriceRange,
  buildSearchQuery,
} from '../lib/exploreFilters';
import { PlaceholderImage } from '../components/ui/PlaceholderImage';
import { CountUp } from '../components/ui/CountUp';
import { SpaceCard } from '../components/spaces/SpaceCard';
import * as useAuthModule from '../features/auth/useAuth';

// Mock useNavigate from react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Phase F2A: Explore Filters & URL Parsing', () => {
  it('parses URL search parameters to strongly typed filter state', () => {
    const search = '?q=heritage&city=Bengaluru&spaceType=ROOM,STUDIO&priceUnit=DAY&minPrice=1500&maxPrice=25000&minCapacity=4&sort=rating&page=2';
    const parsed = parseExploreFilters(search);

    expect(parsed.q).toBe('heritage');
    expect(parsed.city).toBe('Bengaluru');
    expect(parsed.spaceTypes).toEqual(['ROOM', 'STUDIO']);
    expect(parsed.priceUnit).toBe('DAY');
    expect(parsed.minPrice).toBe(1500);
    expect(parsed.maxPrice).toBe(25000);
    expect(parsed.minCapacity).toBe(4);
    expect(parsed.sort).toBe('rating');
    expect(parsed.page).toBe(2);
  });

  it('serializes filter state to clean URL query string and round-trips back', () => {
    const filters = {
      q: 'studio',
      city: 'Goa',
      spaceTypes: ['VILLA', 'STUDIO'],
      priceUnit: 'HOUR',
      minPrice: 500,
      maxPrice: 10000,
      minCapacity: 2,
      sort: 'price_asc',
      page: 3,
    };

    const queryStr = serializeExploreFilters(filters);
    expect(queryStr).toContain('q=studio');
    expect(queryStr).toContain('city=Goa');
    expect(queryStr).toContain('spaceType=VILLA%2CSTUDIO');
    expect(queryStr).toContain('priceUnit=HOUR');
    expect(queryStr).toContain('minPrice=500');
    expect(queryStr).toContain('maxPrice=10000');
    expect(queryStr).toContain('minCapacity=2');
    expect(queryStr).toContain('sort=price_asc');
    expect(queryStr).toContain('page=3');

    // Round-trip verification
    const roundTripped = parseExploreFilters(queryStr);
    expect(roundTripped.q).toBe(filters.q);
    expect(roundTripped.city).toBe(filters.city);
    expect(roundTripped.spaceTypes).toEqual(filters.spaceTypes);
    expect(roundTripped.priceUnit).toBe(filters.priceUnit);
    expect(roundTripped.minPrice).toBe(filters.minPrice);
    expect(roundTripped.maxPrice).toBe(filters.maxPrice);
    expect(roundTripped.minCapacity).toBe(filters.minCapacity);
    expect(roundTripped.sort).toBe(filters.sort);
    expect(roundTripped.page).toBe(filters.page);
  });

  it('omits empty and default values when serializing', () => {
    const emptyFilters = {
      q: '',
      city: '',
      spaceTypes: [],
      priceUnit: '',
      minPrice: '',
      maxPrice: '',
      minCapacity: '',
      sort: 'newest',
      page: 1,
    };
    expect(serializeExploreFilters(emptyFilters)).toBe('');
  });
});

describe('Phase F2A: Price Range Formatting with Indian Grouping', () => {
  it('formats amounts with Indian grouping', () => {
    expect(formatPriceIndian(0)).toBe('₹0');
    expect(formatPriceIndian(500)).toBe('₹500');
    expect(formatPriceIndian(1500)).toBe('₹1,500');
    expect(formatPriceIndian(12500)).toBe('₹12,500');
    expect(formatPriceIndian(125000)).toBe('₹1,25,000');
    expect(formatPriceIndian(1250000)).toBe('₹12,50,000');
    expect(formatPriceIndian(10000000)).toBe('₹1,00,00,000');
  });

  it('formats price ranges with the rupee symbol', () => {
    expect(formatPriceRange(500, 15000)).toBe('₹500 – ₹15,000');
    expect(formatPriceRange(2000, 150000)).toBe('₹2,000 – ₹1,50,000');
  });
});

describe('Phase F2A: Home Search Bar Query Building', () => {
  it('builds search query string from criteria', () => {
    expect(
      buildSearchQuery({ city: 'Bengaluru', spaceType: 'OFFICE', guests: 6 })
    ).toBe('/explore?city=Bengaluru&spaceType=OFFICE&minCapacity=6');
  });

  it('handles partial criteria and empty values', () => {
    expect(buildSearchQuery({ city: 'Mumbai' })).toBe('/explore?city=Mumbai');
    expect(buildSearchQuery({ spaceType: 'ROOM' })).toBe('/explore?spaceType=ROOM');
    expect(buildSearchQuery({})).toBe('/explore');
  });
});

describe('Phase F2A: Favorite Heart Guest Redirect', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('redirects unauthenticated guest to /login when favorite heart is clicked', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      role: 'CUSTOMER',
      profile: null,
    });

    const mockSpace = {
      id: 'space-123',
      name: 'Heritage Villa Suite',
      spaceType: 'ROOM',
      capacity: 4,
      priceAmount: '4500.00',
      priceUnit: 'DAY',
      isFavorite: false,
      property: { city: 'Udaipur', state: 'Rajasthan' },
    };

    render(
      <MemoryRouter>
        <SpaceCard space={mockSpace} />
      </MemoryRouter>
    );

    const favoriteButton = screen.getByRole('button', { name: /add to favorites/i });
    expect(favoriteButton).toBeInTheDocument();

    fireEvent.click(favoriteButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

describe('Phase P1: PlaceholderImage fallback surface', () => {
  const allSpaceTypes = ['ROOM', 'OFFICE', 'STUDIO', 'SHOP', 'CLASSROOM', 'PARKING', 'OTHER'];

  allSpaceTypes.forEach((type) => {
    it(`renders plain sand fallback with Lucide icon for archetype: ${type}`, () => {
      const { container } = render(
        <PlaceholderImage spaceType={type} title={`Test ${type}`} />
      );

      const imgRole = screen.getByRole('img', { name: new RegExp(type, 'i') });
      expect(imgRole).toBeInTheDocument();

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(screen.getByText('No photo yet')).toBeInTheDocument();
    });
  });
});

describe('Phase F2A: CountUp under Reduced Motion', () => {
  it('immediately displays the final target value when prefers-reduced-motion is active', () => {
    // Mock matchMedia for prefers-reduced-motion: reduce -> true
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<CountUp end={148} suffix="+" />);

    // Should immediately show "148+" without waiting for animation frames
    expect(screen.getByText('148+')).toBeInTheDocument();
  });
});
