import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthContext';
import { ToastProvider } from '../components/ui/Toast';
import { PublicLayout } from '../components/layout/PublicLayout';
import { LandingPage } from '../pages/LandingPage';
import { SignupPage } from '../pages/auth/SignupPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { supabase } from '../lib/supabase';
import { api } from '../api/client';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockCustomerProfile = {
  id: 'cust-1',
  name: 'Aarav Patel',
  email: 'aarav@nexora.com',
  role: 'CUSTOMER',
  is_active: true,
};

function renderWithProviders(ui, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <ToastProvider>{ui}</ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const mockSpacesPage1 = {
  data: [
    {
      id: 'sp-1',
      name: 'Lotus Studio',
      spaceType: 'STUDIO',
      capacity: 12,
      priceAmount: '2400.00',
      priceUnit: 'DAY',
      averageRating: '4.8',
      reviewCount: 5,
      coverImageUrl: 'https://images.unsplash.com/photo-1.jpg',
      property: { city: 'Bengaluru', state: 'Karnataka' },
    },
    {
      id: 'sp-2',
      name: 'Gulmohar Conference Room',
      spaceType: 'ROOM',
      capacity: 20,
      priceAmount: '3500.00',
      priceUnit: 'DAY',
      averageRating: '0',
      reviewCount: 0,
      coverImageUrl: null,
      property: { city: 'Mumbai', state: 'Maharashtra' },
    },
  ],
  meta: {
    page: 1,
    pageSize: 6,
    total: 3,
    totalPages: 2,
  },
};

const mockSpacesPage2 = {
  data: [
    {
      id: 'sp-3',
      name: 'Amber Boardroom',
      spaceType: 'ROOM',
      capacity: 8,
      priceAmount: '1800.00',
      priceUnit: 'HOUR',
      averageRating: '4.9',
      reviewCount: 12,
      coverImageUrl: 'https://images.unsplash.com/photo-3.jpg',
      property: { city: 'Delhi', state: 'Delhi' },
    },
  ],
  meta: {
    page: 2,
    pageSize: 6,
    total: 3,
    totalPages: 2,
  },
};

describe('Landing Page & Public Top Bar Rebuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    api.get.mockImplementation((url, config) => {
      if (url === '/api/auth/me') return Promise.resolve(null);
      if (url === '/api/catalog/filters') {
        return Promise.resolve({
          cities: ['Bengaluru', 'Mumbai', 'Delhi'],
          spaceTypes: ['ROOM', 'STUDIO', 'OFFICE'],
        });
      }
      if (url === '/api/spaces') {
        const page = config?.params?.page || 1;
        const pageSize = config?.params?.pageSize;
        if (pageSize === 1) {
          return Promise.resolve({ data: [], meta: { total: 42 } });
        }
        if (page === 2) {
          return Promise.resolve(mockSpacesPage2);
        }
        return Promise.resolve(mockSpacesPage1);
      }
      return Promise.resolve({ data: [] });
    });
  });

  describe('Step 1: Top Bar & Footer', () => {
    it('guest top bar contains ONLY the Nexora wordmark on the left and NO links, buttons, or drawer', () => {
      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      );

      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();

      // Monogram / Wordmark present
      expect(within(header).getByText('Nexora')).toBeInTheDocument();

      // No navigation links in top bar
      expect(within(header).queryByRole('link', { name: /^Explore$/i })).toBeNull();
      expect(within(header).queryByRole('link', { name: /^How it works$/i })).toBeNull();
      expect(within(header).queryByRole('link', { name: /^Design system$/i })).toBeNull();

      // No Log in / Sign up buttons in top bar
      expect(within(header).queryByRole('link', { name: /^Log in$/i })).toBeNull();
      expect(within(header).queryByRole('link', { name: /^Sign up$/i })).toBeNull();

      // No mobile hamburger menu button
      expect(within(header).queryByRole('button', { name: /open menu/i })).toBeNull();
      expect(within(header).queryByRole('button', { name: /menu/i })).toBeNull();
    });

    it('authenticated user sees the account dropdown menu on the right', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'fake-token', user: { email: 'aarav@nexora.com' } } },
        error: null,
      });
      api.get.mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
        return Promise.resolve({ data: [] });
      });

      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      );

      const accountBtn = await screen.findByLabelText(/account menu/i);
      expect(accountBtn).toBeInTheDocument();
      expect(accountBtn).toHaveTextContent('Aarav Patel');
    });

    it('footer contains three role columns (Customers, Owners, Service providers) and small print', () => {
      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      );

      const footer = screen.getByRole('contentinfo');
      expect(footer).toBeInTheDocument();

      // Column titles
      expect(within(footer).getByText('Customers')).toBeInTheDocument();
      expect(within(footer).getByText('Owners')).toBeInTheDocument();
      expect(within(footer).getByText('Service providers')).toBeInTheDocument();

      // Role links in footer
      const loginLinks = within(footer).getAllByRole('link', { name: /^log in$/i });
      expect(loginLinks).toHaveLength(3);
      expect(loginLinks[0]).toHaveAttribute('href', '/login?role=customer');
      expect(loginLinks[1]).toHaveAttribute('href', '/login?role=owner');
      expect(loginLinks[2]).toHaveAttribute('href', '/login?role=provider');

      const createLinks = within(footer).getAllByRole('link', { name: /^create account$/i });
      expect(createLinks).toHaveLength(3);
      expect(createLinks[0]).toHaveAttribute('href', '/signup?role=customer');
      expect(createLinks[1]).toHaveAttribute('href', '/signup?role=owner');
      expect(createLinks[2]).toHaveAttribute('href', '/signup?role=provider');

      // Small print
      expect(within(footer).getByText(/Nexora Hospitality Group\. All rights reserved\./i)).toBeInTheDocument();
      expect(within(footer).getByText(/Kolkata Standard Time \(IST\) • Payments in INR \(₹\)/i)).toBeInTheDocument();

      // Banned copy and removed sections
      expect(within(footer).queryByText(/Zero Emoticon Guarantee/i)).toBeNull();
      expect(within(footer).queryByText(/Platform/i)).toBeNull();
      expect(within(footer).queryByText(/Partner Portal/i)).toBeNull();
      expect(within(footer).queryByText(/Join as a Service Partner/i)).toBeNull();
    });
  });

  describe('Step 2 & 3: Role Preselection on /signup and Visual Hint on /login', () => {
    it('/signup?role=owner preselects the OWNER role', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
        </Routes>,
        { route: '/signup?role=owner' }
      );

      const ownerBtn = screen.getByRole('button', { name: /^Property Steward$/i });
      expect(ownerBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('/signup?role=provider preselects the PROVIDER role', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
        </Routes>,
        { route: '/signup?role=provider' }
      );

      const providerBtn = screen.getByRole('button', { name: /^Service Provider$/i });
      expect(providerBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('/login?role=owner shows subtle visual hint for property owner', () => {
      renderWithProviders(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>,
        { route: '/login?role=owner' }
      );

      expect(screen.getByText(/Signing in as Property owner/i)).toBeInTheDocument();
    });

    it('/login?role=admin never displays an admin hint', () => {
      renderWithProviders(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>,
        { route: '/login?role=admin' }
      );

      expect(screen.queryByText(/admin/i)).toBeNull();
    });
  });

  describe('Step 2: Continuous Scroll Landing Page Sections', () => {
    it('renders hero with factual Bodoni Moda headline and image', async () => {
      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>
        </Routes>
      );

      expect(
        screen.getByRole('heading', { level: 1, name: /Rooms, halls and offices you can book\./i })
      ).toBeInTheDocument();
      expect(
        screen.getByAltText(/Spaces for meetings, halls and offices/i)
      ).toBeInTheDocument();

      // No hero search bar or "View all" explore links
      expect(screen.queryByPlaceholderText(/Any city in India/i)).toBeNull();
      expect(screen.queryByRole('link', { name: /View all spaces/i })).toBeNull();
    });

    it('renders 3-column Sign in section with role links for guests', async () => {
      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>
        </Routes>
      );

      expect(
        await screen.findByRole('heading', { level: 2, name: /Sign in or create an account/i })
      ).toBeInTheDocument();

      // Column headings
      expect(screen.getByRole('heading', { level: 3, name: /^Customer$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: /^Owner$/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: /^Service provider$/i })).toBeInTheDocument();

      // Role login links
      const allLoginLinks = screen.getAllByRole('link', { name: /^Log in$/i });
      expect(allLoginLinks.some((l) => l.getAttribute('href') === '/login?role=customer')).toBe(true);
      expect(allLoginLinks.some((l) => l.getAttribute('href') === '/login?role=owner')).toBe(true);
      expect(allLoginLinks.some((l) => l.getAttribute('href') === '/login?role=provider')).toBe(true);

      // Role create account links
      const allCreateLinks = screen.getAllByRole('link', { name: /^Create account$/i });
      expect(allCreateLinks.some((l) => l.getAttribute('href') === '/signup?role=customer')).toBe(true);
      expect(allCreateLinks.some((l) => l.getAttribute('href') === '/signup?role=owner')).toBe(true);
      expect(allCreateLinks.some((l) => l.getAttribute('href') === '/signup?role=provider')).toBe(true);
    });

    it('renders facts numbers from API and hides when unavailable', async () => {
      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>
        </Routes>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Available spaces')[0]).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('Cities')).toBeInTheDocument();
        expect(screen.getAllByText('3')).toHaveLength(2);
      });
    });

    it('renders infinite scroll listings (id="spaces") and loads more pages on button click', async () => {
      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>
        </Routes>
      );

      // Section has id="spaces"
      const spacesSection = document.getElementById('spaces');
      expect(spacesSection).toBeInTheDocument();

      // Page 1 spaces loaded
      await waitFor(() => {
        expect(screen.getByText('Lotus Studio')).toBeInTheDocument();
        expect(screen.getByText('Gulmohar Conference Room')).toBeInTheDocument();
      });

      // Rating only shown when reviews exist (Lotus Studio has reviewCount: 5, Gulmohar has 0)
      expect(screen.getByText('(5)')).toBeInTheDocument();
      expect(screen.queryByText('(0)')).toBeNull();

      // Has "Load more" fallback button
      const loadMoreBtn = screen.getByRole('button', { name: /Load more/i });
      expect(loadMoreBtn).toBeInTheDocument();

      // Click "Load more" to fetch page 2
      fireEvent.click(loadMoreBtn);

      await waitFor(() => {
        expect(screen.getByText('Amber Boardroom')).toBeInTheDocument();
      });

      // After page 2 (totalPages = 2), "That is every available space" appears
      await waitFor(() => {
        expect(screen.getByText(/That is every available space/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Load more/i })).toBeNull();
      });
    });

    it('renders How It Works numbered list with 01, 02, 03', () => {
      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>
        </Routes>
      );

      expect(screen.getByText('01')).toBeInTheDocument();
      expect(screen.getByText('Search and compare')).toBeInTheDocument();

      expect(screen.getByText('02')).toBeInTheDocument();
      expect(screen.getByText('Get a quote and book')).toBeInTheDocument();

      expect(screen.getByText('03')).toBeInTheDocument();
      expect(screen.getByText('On-site support')).toBeInTheDocument();
    });

    it('renders empty state when filters match zero spaces', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/api/spaces') {
          return Promise.resolve({ data: [], meta: { page: 1, pageSize: 6, total: 0, totalPages: 0 } });
        }
        if (url === '/api/catalog/filters') {
          return Promise.resolve({ cities: [], spaceTypes: [] });
        }
        return Promise.resolve({ data: [] });
      });

      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>
        </Routes>
      );

      await waitFor(() => {
        expect(screen.getByText(/No spaces match your filters/i)).toBeInTheDocument();
      });
    });

    it('renders error state with retry button when API fails', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/api/spaces') {
          return Promise.reject(new Error('Network disconnected'));
        }
        if (url === '/api/catalog/filters') {
          return Promise.resolve({ cities: [], spaceTypes: [] });
        }
        return Promise.resolve({ data: [] });
      });

      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>
        </Routes>
      );

      await waitFor(() => {
        expect(screen.getByText(/Network disconnected/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      });
    });
  });
});
