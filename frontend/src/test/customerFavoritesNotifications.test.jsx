import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthContext';
import { ToastProvider } from '../components/ui/Toast';
import { FavoritesPage } from '../pages/favorites/FavoritesPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
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

const mockCustomerProfile = {
  id: 'cust-1',
  name: 'Aanya Verma',
  email: 'aanya@nexora.com',
  role: 'CUSTOMER',
  is_active: true,
};

const mockSavedSpaces = [
  {
    id: 'fav-1',
    name: 'Garden Haveli Alcove',
    spaceType: 'ROOM',
    capacity: 2,
    priceAmount: '4500.00',
    priceUnit: 'DAY',
    property: {
      title: 'Haveli of the Sun',
      city: 'Jodhpur',
      state: 'Rajasthan',
    },
    coverImageUrl: 'https://images.unsplash.com/photo-fav-1',
    averageRating: 4.9,
    reviewCount: 12,
    isFavorite: true,
  },
  {
    id: 'fav-2',
    name: 'High Ceiling Pottery Loft',
    spaceType: 'STUDIO',
    capacity: 4,
    priceAmount: '1200.00',
    priceUnit: 'HOUR',
    property: {
      title: 'Ceramic Workshop',
      city: 'Jaipur',
      state: 'Rajasthan',
    },
    coverImageUrl: 'https://images.unsplash.com/photo-fav-2',
    averageRating: 4.8,
    reviewCount: 6,
    isFavorite: true,
  },
];

const mockNotifications = [
  {
    id: 'notif-1',
    type: 'BOOKING_CONFIRMED',
    title: 'Booking Confirmed by Host',
    message: 'Your stay at Garden Haveli Alcove has been confirmed by Kavita Sundaram.',
    readAt: null, // Unread
    linkUrl: '/bookings/b-confirmed-1',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'notif-2',
    type: 'PAYMENT_RECEIVED',
    title: 'Payment Received',
    message: 'Payment of ₹2,000.00 has been recorded for Ref #b-confirmed-1.',
    readAt: new Date().toISOString(), // Read
    linkUrl: '/bookings/b-confirmed-1',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

describe('Customer Favorites & Notifications Flow - Vitest Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'fake-token', user: { id: 'cust-1' } } },
      error: null,
    });

    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Favorites list and handles removal with undo action', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      if (url === '/api/favorites') {
        return Promise.resolve({
          data: mockSavedSpaces,
          meta: { page: 1, pageSize: 9, total: 2, totalPages: 1 },
        });
      }
      return Promise.resolve(null);
    });

    renderWithProviders(
      <Routes>
        <Route path="/favorites" element={<FavoritesPage />} />
      </Routes>,
      { route: '/favorites' }
    );

    expect(await screen.findByRole('heading', { level: 1, name: /saved spaces/i })).toBeInTheDocument();
    expect(await screen.findByText('Garden Haveli Alcove')).toBeInTheDocument();
    expect(screen.getByText('High Ceiling Pottery Loft')).toBeInTheDocument();

    // Find heart buttons on the cards
    const heartButtons = screen.getAllByRole('button', { name: /remove from favorites/i });
    expect(heartButtons.length).toBe(2);

    // Click heart button on first item to unfavorite
    api.delete.mockResolvedValueOnce({ success: true });
    fireEvent.click(heartButtons[0]);

    // Toast pops with Undo action button
    const undoButton = await screen.findByRole('button', { name: /undo/i });
    expect(undoButton).toBeInTheDocument();
    expect(screen.getByText(/removed "garden haveli alcove" from favorites/i)).toBeInTheDocument();

    // Click Undo: restores the item and calls PUT /api/favorites/:id
    api.put.mockResolvedValueOnce({ success: true });
    fireEvent.click(undoButton);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/api/favorites/fav-1');
      expect(screen.getByText('Garden Haveli Alcove')).toBeInTheDocument();
    });
  });

  it('notifications list renders unread indicators, marks individual notification read, and marks all read', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      if (url === '/api/notifications') {
        return Promise.resolve({
          data: mockNotifications,
          meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
        });
      }
      return Promise.resolve(null);
    });

    renderWithProviders(
      <Routes>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/bookings/:id" element={<div data-testid="booking-target">Booking Target</div>} />
      </Routes>,
      { route: '/notifications' }
    );

    expect(await screen.findByRole('heading', { level: 1, name: /notifications/i })).toBeInTheDocument();
    expect(await screen.findByText('Booking Confirmed by Host')).toBeInTheDocument();
    expect(screen.getByText('Payment Received')).toBeInTheDocument();

    // Verify unread indicator exists for unread notification
    expect(screen.getByLabelText(/unread notification/i)).toBeInTheDocument();

    // 1. Mark all read button
    const markAllButton = screen.getByRole('button', { name: /mark all read/i });
    api.post.mockResolvedValueOnce({ count: 1 });

    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/notifications/read-all');
    });

    // 2. Click individual unread notification: marks read and navigates to target link
    api.patch.mockResolvedValueOnce({ id: 'notif-1', readAt: new Date().toISOString() });

    fireEvent.click(screen.getByText('Booking Confirmed by Host'));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/api/notifications/notif-1/read');
      expect(screen.getByTestId('booking-target')).toBeInTheDocument();
    });
  });
});
