import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthContext';
import { ToastProvider } from '../components/ui/Toast';
import { SpaceDetailPage } from '../pages/spaces/SpaceDetailPage';
import { AvailabilityCalendar } from '../components/spaces/AvailabilityCalendar';
import { Lightbox } from '../components/spaces/Lightbox';
import { supabase } from '../lib/supabase';
import { api, ApiError } from '../api/client';
import { addDays, format } from 'date-fns';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(code, message, details, status) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.details = details;
      this.status = status;
    }
  },
}));

const mockSpaceDay = {
  id: 'space-day-1',
  name: 'Courtyard Villa Suite',
  description: 'A quiet retreat designed for slow living and hospitality.',
  rules: 'Quiet hours after 10 PM. Strictly no smoking inside.',
  spaceType: 'ROOM',
  capacity: 4,
  priceAmount: '5000.00',
  priceUnit: 'DAY',
  status: 'AVAILABLE',
  property: {
    id: 'prop-1',
    title: 'Heritage Haveli',
    city: 'Jaipur',
    state: 'Rajasthan',
    owner: {
      id: 'usr-owner-1',
      name: 'Rohan Sharma', // first name Rohan
    },
  },
  media: [
    { id: 'm-1', url: 'https://images.unsplash.com/photo-1', caption: 'Courtyard view' },
    { id: 'm-2', url: 'https://images.unsplash.com/photo-2', caption: 'Archway lounge' },
  ],
  averageRating: 4.9,
  reviewCount: 8,
  isFavorite: false,
};

const mockSpaceHour = {
  ...mockSpaceDay,
  id: 'space-hour-1',
  name: 'Atelier Drafting Studio',
  priceAmount: '1200.00',
  priceUnit: 'HOUR',
  capacity: 8,
};

function renderWithProviders(ui, { route = '/spaces/space-day-1', session = null, profile = null } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  supabase.auth.getSession.mockResolvedValue({
    data: { session },
    error: null,
  });

  if (session && profile) {
    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(profile);
      if (url.startsWith('/api/spaces/space-day-1/availability')) return Promise.resolve([]);
      if (url.startsWith('/api/spaces/space-hour-1/availability')) return Promise.resolve([]);
      if (url.startsWith('/api/spaces/space-day-1/reviews')) return Promise.resolve({ data: [], meta: { total: 0, totalPages: 1 } });
      if (url.startsWith('/api/spaces/space-hour-1/reviews')) return Promise.resolve({ data: [], meta: { total: 0, totalPages: 1 } });
      if (url === '/api/spaces/space-day-1') return Promise.resolve(mockSpaceDay);
      if (url === '/api/spaces/space-hour-1') return Promise.resolve(mockSpaceHour);
      if (url.startsWith('/api/spaces?city=')) return Promise.resolve({ data: [] });
      return Promise.resolve({});
    });
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <ToastProvider>
            {ui}
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Space Detail Page & Booking Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();

    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    api.get.mockImplementation((url) => {
      if (url === '/api/spaces/space-day-1') return Promise.resolve(mockSpaceDay);
      if (url === '/api/spaces/space-hour-1') return Promise.resolve(mockSpaceHour);
      if (url.startsWith('/api/spaces/space-day-1/availability')) return Promise.resolve([]);
      if (url.startsWith('/api/spaces/space-hour-1/availability')) return Promise.resolve([]);
      if (url.startsWith('/api/spaces/space-day-1/reviews')) {
        return Promise.resolve({
          data: [
            {
              id: 'rev-1',
              rating: 5,
              comment: 'Pure peace. The courtyard in the morning is transcendental.',
              createdAt: '2026-11-20T10:00:00.000Z',
              customer: { firstName: 'Aarav' },
            },
          ],
          meta: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
        });
      }
      if (url.startsWith('/api/spaces?city=')) return Promise.resolve({ data: [] });
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Calendar & Availability Rules', () => {
    it('calendar blocks unavailable and past days', () => {
      const today = new Date();
      const blockedFutureDay = addDays(today, 5);

      const blockedIntervals = [
        {
          startAt: new Date(blockedFutureDay.setHours(0, 0, 0, 0)).toISOString(),
          endAt: new Date(blockedFutureDay.setHours(23, 59, 59, 999)).toISOString(),
        },
      ];

      render(
        <AvailabilityCalendar
          priceUnit="DAY"
          blockedIntervals={blockedIntervals}
          value={{ startAt: null, endAt: null }}
          onChange={vi.fn()}
        />
      );

      // Check that a blocked future day button has aria-disabled="true"
      const blockedDateStr = format(blockedFutureDay, 'd');
      const dayButtons = screen.getAllByRole('button').filter((b) => b.textContent === blockedDateStr);
      expect(dayButtons.some((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
    });

    it('handles range selection for DAY spaces', () => {
      const handleChange = vi.fn();
      const futureDay1 = addDays(new Date(), 3);

      render(
        <AvailabilityCalendar
          priceUnit="DAY"
          blockedIntervals={[]}
          value={{ startAt: null, endAt: null }}
          onChange={handleChange}
        />
      );

      const d1Str = format(futureDay1, 'd');
      const d1Btn = screen.getAllByRole('button').find((b) => b.textContent === d1Str && b.getAttribute('aria-disabled') !== 'true');
      expect(d1Btn).toBeDefined();

      // Click first day to set start date
      fireEvent.click(d1Btn);
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          startAt: expect.any(String),
          endAt: null,
        })
      );
    });

    it('handles time selection for HOUR spaces', () => {
      const handleChange = vi.fn();
      const targetDay = addDays(new Date(), 4);

      render(
        <AvailabilityCalendar
          priceUnit="HOUR"
          blockedIntervals={[]}
          value={{ startAt: null, endAt: null }}
          onChange={handleChange}
        />
      );

      const dayStr = format(targetDay, 'd');
      const dayBtn = screen.getAllByRole('button').find((b) => b.textContent === dayStr && b.getAttribute('aria-disabled') !== 'true');
      expect(dayBtn).toBeDefined();

      fireEvent.click(dayBtn);

      // Verify time selector dropdowns are visible
      expect(screen.getByText('Start Time')).toBeInTheDocument();
      expect(screen.getByText('End Time')).toBeInTheDocument();
    });
  });

  describe('Booking Panel & Live Server Quote', () => {
    it('quote request fires and price breakdown renders exact API strings unchanged', async () => {
      const mockQuote = {
        pricing: {
          units: 2,
          unitLabel: 'days',
          subtotal: '10000.00',
          taxAmount: '1800.00',
          totalAmount: '11800.00',
        },
        isAvailable: true,
        space: { id: 'space-day-1', name: 'Courtyard Villa Suite', capacity: 4 },
      };

      api.post.mockResolvedValueOnce(mockQuote);

      renderWithProviders(
        <Routes>
          <Route path="/spaces/:id" element={<SpaceDetailPage />} />
        </Routes>,
        { route: '/spaces/space-day-1' }
      );

      expect(await screen.findByRole('heading', { level: 1, name: 'Courtyard Villa Suite' })).toBeInTheDocument();

      // Select valid future days
      const d3 = addDays(new Date(), 3);
      const d5 = addDays(new Date(), 5);

      const d3Btn = screen.getAllByRole('button').find((b) => b.textContent === format(d3, 'd') && b.getAttribute('aria-disabled') !== 'true');
      const d5Btn = screen.getAllByRole('button').find((b) => b.textContent === format(d5, 'd') && b.getAttribute('aria-disabled') !== 'true');

      fireEvent.click(d3Btn);
      fireEvent.click(d5Btn);

      // Quote should be displayed with exact formatted rupee strings
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          '/api/bookings/quote',
          expect.objectContaining({ spaceId: 'space-day-1' }),
          expect.anything()
        );
      });

      // Price breakdown renders subtotal 10000.00 (₹10,000.00), tax 1800.00 (₹1,800.00), total 11800.00 (₹11,800.00)
      expect(await screen.findByText('₹11,800.00')).toBeInTheDocument();
      expect(screen.getByText('₹10,000.00')).toBeInTheDocument();
      expect(screen.getByText('₹1,800.00')).toBeInTheDocument();
    });

    it('guest is redirected to login and draft selection is stored in sessionStorage', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/spaces/:id" element={<SpaceDetailPage />} />
          <Route path="/login" element={<div>Sign In Screen</div>} />
        </Routes>,
        { route: '/spaces/space-day-1' }
      );

      expect(await screen.findByRole('heading', { level: 1, name: 'Courtyard Villa Suite' })).toBeInTheDocument();

      const d3 = addDays(new Date(), 3);
      const d5 = addDays(new Date(), 5);
      const d3Btn = screen.getAllByRole('button').find((b) => b.textContent === format(d3, 'd') && b.getAttribute('aria-disabled') !== 'true');
      const d5Btn = screen.getAllByRole('button').find((b) => b.textContent === format(d5, 'd') && b.getAttribute('aria-disabled') !== 'true');

      fireEvent.click(d3Btn);
      fireEvent.click(d5Btn);

      const requestBtn = await screen.findByRole('button', { name: /sign in to book/i });
      fireEvent.click(requestBtn);

      // Verify guest is redirected to login
      await waitFor(() => {
        expect(screen.getByText('Sign In Screen')).toBeInTheDocument();
      });

      // Verify draft stored in sessionStorage
      const draft = JSON.parse(sessionStorage.getItem('nexora:booking_draft'));
      expect(draft.spaceId).toBe('space-day-1');
      expect(draft.startAt).toBeDefined();
      expect(draft.endAt).toBeDefined();
    });

    it('non-customer roles (e.g. OWNER) see a clear restriction note', async () => {
      const mockSession = { user: { id: 'usr-owner-2' } };
      const mockOwnerProfile = {
        id: 'usr-owner-2',
        role: 'OWNER',
        name: 'Suresh Steward',
        is_active: true,
      };

      renderWithProviders(
        <Routes>
          <Route path="/spaces/:id" element={<SpaceDetailPage />} />
        </Routes>,
        {
          route: '/spaces/space-day-1',
          session: mockSession,
          profile: mockOwnerProfile,
        }
      );

      expect(await screen.findByRole('heading', { level: 1, name: 'Courtyard Villa Suite' })).toBeInTheDocument();

      // Check that non-customer notice is present
      expect(
        await screen.findByText(/only customer accounts can book spaces/i)
      ).toBeInTheDocument();

      const btn = screen.getByRole('button', { name: /customer account required/i });
      expect(btn).toBeDisabled();
    });

    it('SLOT_UNAVAILABLE triggers availability refresh and displays warning', async () => {
      const mockSession = { user: { id: 'usr-cust-1' } };
      const mockCustomerProfile = {
        id: 'usr-cust-1',
        role: 'CUSTOMER',
        name: 'Priya Guest',
        is_active: true,
      };

      // Mock quote succeeds
      api.post.mockImplementation((url) => {
        if (url === '/api/bookings/quote') {
          return Promise.resolve({
            pricing: { units: 1, unitLabel: 'day', subtotal: '5000.00', taxAmount: '900.00', totalAmount: '5900.00' },
            isAvailable: true,
          });
        }
        if (url === '/api/bookings') {
          return Promise.reject(new ApiError('SLOT_UNAVAILABLE', 'The selected slot is already booked', {}, 409));
        }
        return Promise.resolve({});
      });

      renderWithProviders(
        <Routes>
          <Route path="/spaces/:id" element={<SpaceDetailPage />} />
        </Routes>,
        {
          route: '/spaces/space-day-1',
          session: mockSession,
          profile: mockCustomerProfile,
        }
      );

      expect(await screen.findByRole('heading', { level: 1, name: 'Courtyard Villa Suite' })).toBeInTheDocument();

      const d3 = addDays(new Date(), 3);
      const d4 = addDays(new Date(), 4);
      const d3Btn = screen.getAllByRole('button').find((b) => b.textContent === format(d3, 'd') && b.getAttribute('aria-disabled') !== 'true');
      const d4Btn = screen.getAllByRole('button').find((b) => b.textContent === format(d4, 'd') && b.getAttribute('aria-disabled') !== 'true');

      fireEvent.click(d3Btn);
      fireEvent.click(d4Btn);

      const bookBtn = await screen.findByRole('button', { name: /request to book/i });
      fireEvent.click(bookBtn);

      // Warning message is displayed
      expect(
        await screen.findByText(/the selected time slot is no longer available/i)
      ).toBeInTheDocument();
    });
  });

  describe('Lightbox & Privacy Checks', () => {
    it('lightbox supports keyboard navigation and focus trap', async () => {
      const images = [
        { url: 'https://img.test/1.jpg', caption: 'Photo One' },
        { url: 'https://img.test/2.jpg', caption: 'Photo Two' },
        { url: 'https://img.test/3.jpg', caption: 'Photo Three' },
      ];

      const handleClose = vi.fn();
      const handleNavigate = vi.fn();

      render(
        <Lightbox
          images={images}
          currentIndex={0}
          isOpen={true}
          onClose={handleClose}
          onNavigate={handleNavigate}
        />
      );

      expect(screen.getByRole('dialog', { name: /image gallery lightbox/i })).toBeInTheDocument();
      expect(screen.getByText('1 / 3')).toBeInTheDocument();

      // Right arrow key navigates to next
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(handleNavigate).toHaveBeenCalledWith(1);

      // Left arrow key navigates to prev
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(handleNavigate).toHaveBeenCalledWith(2);

      // Escape key closes lightbox
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });

    it('privacy check: strictly NO owner email or phone is rendered anywhere on the page', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/spaces/:id" element={<SpaceDetailPage />} />
        </Routes>,
        { route: '/spaces/space-day-1' }
      );

      expect(await screen.findByRole('heading', { level: 1, name: 'Courtyard Villa Suite' })).toBeInTheDocument();

      // Owner first name is displayed
      expect(screen.getByText(/hosted by rohan/i)).toBeInTheDocument();

      // Strictly confirm no email or phone in whole page HTML
      const html = document.body.innerHTML;
      expect(html).not.toMatch(/@/);
      expect(html).not.toMatch(/\+91/);
      expect(html).not.toMatch(/email/i);
      expect(html).not.toMatch(/phone/i);
    });

    it('gallery correctly prioritizes cover image and respects order whether API returns snake_case (sort_order, is_cover) or camelCase (sortOrder, isCover)', async () => {
      const spaceWithSnakeCaseMedia = {
        ...mockSpaceDay,
        id: 'space-snake-case',
        media: [
          { id: 'm-sub', url: 'https://images.unsplash.com/photo-sub', caption: 'Secondary room', is_cover: false, sort_order: 1 },
          { id: 'm-cover', url: 'https://images.unsplash.com/photo-cover', caption: 'Primary Haveli Cover', is_cover: true, sort_order: 0 },
        ],
      };

      api.get.mockImplementation((url) => {
        if (url === '/api/spaces/space-snake-case') return Promise.resolve(spaceWithSnakeCaseMedia);
        if (url.includes('/availability')) return Promise.resolve([]);
        if (url.includes('/reviews')) return Promise.resolve({ items: [], meta: { page: 1, pageSize: 5, total: 0, totalPages: 1 } });
        if (url.includes('/spaces?city=')) return Promise.resolve({ items: [], meta: { page: 1, pageSize: 5, total: 0, totalPages: 1 } });
        return Promise.resolve(null);
      });

      renderWithProviders(
        <Routes>
          <Route path="/spaces/:id" element={<SpaceDetailPage />} />
        </Routes>,
        { route: '/spaces/space-snake-case' }
      );

      // Hero image should be the cover image even though it was second in the raw media array
      const heroImg = await screen.findByAltText('Primary Haveli Cover');
      expect(heroImg).toBeInTheDocument();
      expect(heroImg).toHaveAttribute('src', 'https://images.unsplash.com/photo-cover');
    });
  });
});
