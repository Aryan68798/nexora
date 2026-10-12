import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthContext';
import { ToastProvider } from '../components/ui/Toast';
import { PublicLayout } from '../components/layout/PublicLayout';
import { LandingPage } from '../pages/LandingPage';
import { SignupPage } from '../pages/auth/SignupPage';
import { OwnerPropertiesPage } from '../pages/owner/OwnerPropertiesPage';
import { AppRoutes } from '../routes/index';
import { RoleRoute } from '../routes/guards';
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

const mockOwnerProfile = {
  id: 'owner-test-1',
  name: 'Karan Mehra',
  email: 'karan@nexora.com',
  role: 'OWNER',
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
          <ToastProvider>
            {ui}
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Removal of Public Owner Marketing Content', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(null);
      if (url.includes('/api/catalog/filters')) {
        return Promise.resolve({
          data: {
            cities: ['Bengaluru', 'Mumbai'],
            spaceTypes: ['ROOM', 'OFFICE'],
            spaceTypeCounts: { ROOM: 5, OFFICE: 3 },
          },
        });
      }
      if (url.includes('/api/spaces')) {
        return Promise.resolve({
          data: [],
          meta: { total: 0 },
        });
      }
      return Promise.resolve({ data: [] });
    });
  });

  describe('PublicLayout Navigation and Footer', () => {
    it('public header contains no "For owners" link and no guest drawer', () => {
      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div>Public Home</div>} />
          </Route>
        </Routes>
      );

      // 1. Desktop header check: no "For Owners" link anywhere
      expect(screen.queryAllByRole('link', { name: /^For Owners$/i })).toHaveLength(0);
      expect(screen.queryByText(/^For Owners$/i)).toBeNull();

      // 2. Guest top bar has no menu button or drawer
      expect(screen.queryByRole('button', { name: /^Open menu$/i })).toBeNull();
      expect(screen.queryByRole('navigation', { name: /Mobile Navigation/i })).toBeNull();
    });

    it('footer contains no "For owners" or "List your property" link', () => {
      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div>Public Home</div>} />
          </Route>
        </Routes>
      );

      const footer = screen.getByRole('contentinfo');
      expect(footer).toBeInTheDocument();
      expect(footer.textContent).not.toMatch(/for owners/i);
      expect(footer.textContent).not.toMatch(/list your property/i);
      expect(screen.queryByRole('link', { name: /List Your Property/i })).toBeNull();
    });
  });

  describe('Home Page Content', () => {
    it('home page contains no owners and providers marketing section', async () => {
      renderWithProviders(
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>
        </Routes>
      );

      await waitFor(() => {
        expect(screen.getByText(/Rooms, halls and offices you can book/i)).toBeInTheDocument();
      });

      // Confirm Section 6 (id="for-owners") is gone
      const ownerSection = document.getElementById('for-owners');
      expect(ownerSection).toBeNull();

      // Confirm owner marketing headings and copy are gone
      expect(screen.queryByText('List and manage your properties.')).toBeNull();
      expect(screen.queryByText('Join as a verified technician.')).toBeNull();
      expect(screen.queryByRole('button', { name: /List your property/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Offer your services/i })).toBeNull();
    });
  });

  describe('Route Redirection', () => {
    it('redirects requests to /for-owners to the root path ("/") with replace navigation', async () => {
      renderWithProviders(<AppRoutes />, { route: '/for-owners' });

      await waitFor(() => {
        // Redirection should land on the home page headline
        expect(screen.getByText(/Rooms, halls and offices you can book/i)).toBeInTheDocument();
      });

      // And /for-owners content is NOT rendered
      expect(screen.queryByText(/For Property Stewards/i)).toBeNull();
    });
  });

  describe('Sign-up & Owner Portal Invariants', () => {
    it('/signup still offers the owner role (Property Steward)', () => {
      renderWithProviders(
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
        </Routes>,
        { route: '/signup' }
      );

      expect(screen.getByText('Property Steward')).toBeInTheDocument();
      expect(screen.getByText(/List properties, oversee bookings/i)).toBeInTheDocument();
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByText('Service Provider')).toBeInTheDocument();
    });

    it('an OWNER user can still access /owner/properties', async () => {
      supabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: { id: mockOwnerProfile.id, email: mockOwnerProfile.email },
            access_token: 'fake-jwt',
          },
        },
        error: null,
      });

      api.get.mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve(mockOwnerProfile);
        if (url.includes('/api/properties')) {
          return Promise.resolve({
            data: [
              {
                id: 'prop-1',
                title: 'Heritage Haveli',
                city: 'Udaipur',
                state: 'Rajasthan',
                propertyType: 'VILLA',
                status: 'ACTIVE',
                spaceCount: 3,
                coverImageUrl: null,
              },
            ],
            meta: { total: 1, totalPages: 1 },
          });
        }
        return Promise.resolve({ data: [] });
      });

      renderWithProviders(
        <Routes>
          <Route
            path="/owner/properties"
            element={
              <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
                <OwnerPropertiesPage />
              </RoleRoute>
            }
          />
        </Routes>,
        { route: '/owner/properties' }
      );

      await waitFor(() => {
        expect(screen.getByText('My Properties')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Heritage Haveli')).toBeInTheDocument();
      });
    });
  });
});
