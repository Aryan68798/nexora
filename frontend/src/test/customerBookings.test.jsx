import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthContext';
import { ToastProvider } from '../components/ui/Toast';
import { MyBookingsPage } from '../pages/bookings/MyBookingsPage';
import { BookingDetailPage } from '../pages/bookings/BookingDetailPage';
import { supabase } from '../lib/supabase';
import { api, ApiError } from '../api/client';
import { addDays, subHours, addHours } from 'date-fns';

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

const mockBookingPending = {
  id: 'b-pending-1',
  spaceId: 'sp-1',
  customerId: 'cust-1',
  startAt: addDays(new Date(), 5).toISOString(),
  endAt: addDays(new Date(), 6).toISOString(),
  guestCount: 2,
  status: 'PENDING',
  subtotal: '4000.00',
  taxAmount: '720.00',
  totalAmount: '4720.00',
  paidAmount: '0.00',
  space: {
    id: 'sp-1',
    name: 'Courtyard Haveli',
    spaceType: 'ROOM',
    property: {
      id: 'prop-1',
      title: 'Udaipur Palace',
      city: 'Udaipur',
      state: 'Rajasthan',
      owner: {
        id: 'owner-1',
        name: 'Devendra Patel',
      },
    },
    coverImageUrl: 'https://images.unsplash.com/photo-haveli',
  },
  allowedNextActions: ['cancel'],
  payments: [],
  statusHistory: [
    {
      id: 'h-1',
      status: 'PENDING',
      changedBy: 'Aanya Verma',
      note: 'Reservation requested by guest',
      changedAt: new Date().toISOString(),
    },
  ],
};

const mockBookingConfirmed = {
  id: 'b-confirmed-1',
  spaceId: 'sp-2',
  customerId: 'cust-1',
  startAt: addHours(new Date(), 48).toISOString(), // > 24 hours in the future
  endAt: addHours(new Date(), 56).toISOString(),
  guestCount: 3,
  status: 'CONFIRMED',
  subtotal: '5000.00',
  taxAmount: '900.00',
  totalAmount: '5900.00',
  paidAmount: '2000.00', // Remaining balance: 3900.00
  space: {
    id: 'sp-2',
    name: 'Terracotta Workshop Studio',
    spaceType: 'STUDIO',
    property: {
      id: 'prop-2',
      title: 'Clay & Kiln Residency',
      city: 'Jaipur',
      state: 'Rajasthan',
      addressLine1: '42 Potters Lane',
      owner: {
        id: 'owner-2',
        name: 'Kavita Sundaram',
      },
    },
    coverImageUrl: 'https://images.unsplash.com/photo-studio',
  },
  allowedNextActions: ['pay', 'cancel'],
  payments: [
    {
      id: 'p-1',
      amount: '2000.00',
      currency: 'INR',
      paymentMethod: 'UPI',
      status: 'PAID',
      transactionReference: 'SIM-TXN-1001',
      paidAt: subHours(new Date(), 2).toISOString(),
    },
  ],
  statusHistory: [
    {
      id: 'h-2',
      status: 'CONFIRMED',
      changedBy: 'Kavita Sundaram',
      note: 'Reservation approved by host',
      changedAt: subHours(new Date(), 3).toISOString(),
    },
    {
      id: 'h-1',
      status: 'PENDING',
      changedBy: 'Aanya Verma',
      note: 'Requested by guest',
      changedAt: subHours(new Date(), 4).toISOString(),
    },
  ],
};

const mockBookingCompleted = {
  id: 'b-completed-1',
  spaceId: 'sp-3',
  customerId: 'cust-1',
  startAt: subHours(new Date(), 72).toISOString(),
  endAt: subHours(new Date(), 48).toISOString(),
  guestCount: 1,
  status: 'COMPLETED',
  subtotal: '2000.00',
  taxAmount: '360.00',
  totalAmount: '2360.00',
  paidAmount: '2360.00',
  space: {
    id: 'sp-3',
    name: 'Quiet Library Alcove',
    spaceType: 'OFFICE',
    property: {
      id: 'prop-3',
      title: 'Old Town Reading Guild',
      city: 'Kochi',
      state: 'Kerala',
      owner: {
        id: 'owner-3',
        name: 'Mathew Thomas',
      },
    },
  },
  allowedNextActions: ['review'],
  payments: [
    {
      id: 'p-comp',
      amount: '2360.00',
      currency: 'INR',
      paymentMethod: 'CARD',
      status: 'PAID',
      transactionReference: 'SIM-TXN-2002',
      paidAt: subHours(new Date(), 73).toISOString(),
    },
  ],
  statusHistory: [
    {
      id: 'h-comp',
      status: 'COMPLETED',
      changedBy: 'System',
      note: 'Check-out completed',
      changedAt: subHours(new Date(), 48).toISOString(),
    },
  ],
  review: null,
};

describe('Customer Booking Flow - Vitest Test Suite', () => {
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

  it('renders My Bookings page with tabs and displays reservation cards', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      if (url === '/api/bookings/mine') {
        return Promise.resolve({
          data: [mockBookingPending, mockBookingConfirmed],
          meta: { page: 1, pageSize: 6, total: 2, totalPages: 1 },
        });
      }
      return Promise.resolve(null);
    });

    renderWithProviders(
      <Routes>
        <Route path="/bookings" element={<MyBookingsPage />} />
      </Routes>,
      { route: '/bookings' }
    );

    expect(await screen.findByRole('heading', { level: 1, name: /my bookings/i })).toBeInTheDocument();

    // Verify tabs exist
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upcoming/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pending/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /past/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelled/i })).toBeInTheDocument();

    // Verify booking cards rendered (await TanStack Query resolving)
    expect(await screen.findByText('Courtyard Haveli')).toBeInTheDocument();
    expect(screen.getByText('Terracotta Workshop Studio')).toBeInTheDocument();

    // Primary action by status: PENDING shows "Waiting for owner", CONFIRMED with balance shows "Pay now"
    expect(screen.getByText(/waiting for owner/i)).toBeInTheDocument();
    expect(screen.getByText(/pay now/i)).toBeInTheDocument();
  });

  it('renders empty state with link to /explore when no bookings found in selected tab', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      if (url === '/api/bookings/mine') {
        return Promise.resolve({
          data: [],
          meta: { page: 1, pageSize: 6, total: 0, totalPages: 1 },
        });
      }
      return Promise.resolve(null);
    });

    renderWithProviders(
      <Routes>
        <Route path="/bookings" element={<MyBookingsPage />} />
      </Routes>,
      { route: '/bookings?tab=cancelled' }
    );

    expect(await screen.findByText(/no cancelled bookings found/i)).toBeInTheDocument();
    const exploreLink = screen.getByRole('link', { name: /browse spaces/i });
    expect(exploreLink).toBeInTheDocument();
    expect(exploreLink).toHaveAttribute('href', '/#spaces');
  });

  it('actions come strictly from allowedNextActions (never guessed by status on client)', async () => {
    // Booking is CONFIRMED, but server allowedNextActions contains ONLY 'cancel' (pay omitted)
    const bookingWithOnlyCancel = {
      ...mockBookingConfirmed,
      id: 'b-no-pay',
      allowedNextActions: ['cancel'],
    };

    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      if (url === '/api/bookings/b-no-pay') return Promise.resolve(bookingWithOnlyCancel);
      return Promise.resolve(null);
    });

    renderWithProviders(
      <Routes>
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
      </Routes>,
      { route: '/bookings/b-no-pay' }
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Terracotta Workshop Studio' })).toBeInTheDocument();

    // Cancel is in allowedNextActions, so cancel button exists
    expect(screen.getByRole('button', { name: /cancel reservation/i })).toBeInTheDocument();

    // Pay is NOT in allowedNextActions, so pay panel is NEVER rendered
    expect(screen.queryByText(/settle balance/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pay /i })).not.toBeInTheDocument();
  });

  it('pay panel validates amount, blocks overpayment client-side, maps server OVERPAYMENT, and updates balance', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      if (url === '/api/bookings/b-confirmed-1') return Promise.resolve(mockBookingConfirmed);
      return Promise.resolve(null);
    });

    renderWithProviders(
      <Routes>
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
      </Routes>,
      { route: '/bookings/b-confirmed-1' }
    );

    expect(await screen.findByText(/settle balance/i)).toBeInTheDocument();

    // 1. Mandatory demo banner present
    expect(screen.getByText(/demo payment:/i)).toBeInTheDocument();
    expect(screen.getByText(/no real money moves and no card details are collected/i)).toBeInTheDocument();

    // 2. Strict check: NO credit card number input fields anywhere in the document
    expect(screen.queryByPlaceholderText(/card number/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[name="cardNumber"]')).toBeNull();
    expect(document.querySelector('input[autocomplete="cc-number"]')).toBeNull();

    // Balance is ₹3,900.00
    const amountInput = screen.getByPlaceholderText('0.00');
    expect(amountInput.value).toBe('3900.00');

    // 3. Client-side overpayment check: enter 4500.00 (which exceeds 3900.00 balance)
    fireEvent.change(amountInput, { target: { value: '4500.00' } });
    expect(screen.getByText(/amount cannot exceed the remaining balance of ₹3,900\.00/i)).toBeInTheDocument();

    const payButton = screen.getByRole('button', { name: /pay ₹4,500\.00/i });
    expect(payButton).toBeDisabled();

    // 4. Client-side invalid amount: enter 0 or negative
    fireEvent.change(amountInput, { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /pay ₹0\.00/i })).toBeDisabled();

    // 5. Enter partial amount 1500.00 and submit with simulated server OVERPAYMENT error
    fireEvent.change(amountInput, { target: { value: '1500.00' } });
    expect(screen.getByRole('button', { name: /pay ₹1,500\.00/i })).not.toBeDisabled();

    api.post.mockRejectedValueOnce(
      new ApiError('OVERPAYMENT', 'Payment exceeds remaining balance', null, 400)
    );

    fireEvent.click(screen.getByRole('button', { name: /pay ₹1,500\.00/i }));

    await waitFor(() => {
      expect(screen.getByText(/the submitted amount exceeds the remaining balance/i)).toBeInTheDocument();
    });

    // 6. Successful payment settlement
    api.post.mockResolvedValueOnce({
      id: 'p-new',
      bookingId: 'b-confirmed-1',
      amount: '1500.00',
      currency: 'INR',
      paymentMethod: 'UPI',
      status: 'PAID',
      transactionReference: 'SIM-TXN-SUCCESS-777',
      paidAt: new Date().toISOString(),
    });

    fireEvent.click(screen.getByRole('button', { name: /pay ₹1,500\.00/i }));

    await waitFor(() => {
      expect(screen.getByText(/payment successful/i)).toBeInTheDocument();
      expect(screen.getByText(/SIM-TXN-SUCCESS-777/i)).toBeInTheDocument();
    });
  });

  it('cancel dialog shows full refund rule when cancelling >= 24 hours prior to check-in and records outcome', async () => {
    // Case A: Booking start is 48 hours away (>= 24 hours) -> Full Refund Eligible
    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      if (url === '/api/bookings/b-confirmed-1') return Promise.resolve(mockBookingConfirmed);
      return Promise.resolve(null);
    });

    renderWithProviders(
      <Routes>
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
      </Routes>,
      { route: '/bookings/b-confirmed-1' }
    );

    const cancelTrigger = await screen.findByRole('button', { name: /cancel reservation/i });
    fireEvent.click(cancelTrigger);

    // Dialog appears with Full Refund Eligible policy
    expect(screen.getByText(/full refund eligible/i)).toBeInTheDocument();
    expect(screen.getByText(/cancelling at least 24 hours prior to check-in/i)).toBeInTheDocument();

    // Confirm cancel with server response outcome
    api.patch.mockResolvedValueOnce({
      booking: { ...mockBookingConfirmed, status: 'CANCELLED' },
      refundedAmount: '2000.00',
    });

    fireEvent.change(screen.getByPlaceholderText(/tell us why you are cancelling/i), {
      target: { value: 'Change of schedule' },
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/api/bookings/b-confirmed-1/status', {
        status: 'CANCELLED',
        reason: 'Change of schedule',
      });
    });
  });

  it('cancel dialog shows non-refundable policy when cancelling < 24 hours prior to check-in', async () => {
    // Case B: Booking start is 10 hours away (< 24 hours) -> Non-Refundable Window
    const bookingWithin24h = {
      ...mockBookingConfirmed,
      id: 'b-soon-1',
      startAt: addHours(new Date(), 10).toISOString(),
    };

    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      if (url === '/api/bookings/b-soon-1') return Promise.resolve(bookingWithin24h);
      return Promise.resolve(null);
    });

    renderWithProviders(
      <Routes>
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
      </Routes>,
      { route: '/bookings/b-soon-1' }
    );

    const cancelTriggerSoon = await screen.findByRole('button', { name: /cancel reservation/i });
    fireEvent.click(cancelTriggerSoon);

    expect(screen.getByText(/non-refundable window/i)).toBeInTheDocument();
    expect(screen.getByText(/cancellations within 24 hours of check-in are strictly non-refundable/i)).toBeInTheDocument();
  });

  it('review panel only renders for COMPLETED bookings and handles ALREADY_REVIEWED error', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      if (url === '/api/bookings/b-completed-1') return Promise.resolve(mockBookingCompleted);
      return Promise.resolve(null);
    });

    renderWithProviders(
      <Routes>
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
      </Routes>,
      { route: '/bookings/b-completed-1' }
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Quiet Library Alcove' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /leave a review/i })).toBeInTheDocument();

    // Type comment
    const commentInput = screen.getByPlaceholderText(/what made your stay special/i);
    fireEvent.change(commentInput, { target: { value: 'Exceptional quality and natural light.' } });

    // Mock ALREADY_REVIEWED error
    api.post.mockRejectedValueOnce(
      new ApiError('ALREADY_REVIEWED', 'Review already exists', null, 409)
    );

    fireEvent.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() => {
      expect(screen.getByText(/you have already submitted a review for this booking/i)).toBeInTheDocument();
    });

    // Successful review creation
    api.post.mockResolvedValueOnce({
      id: 'rev-101',
      bookingId: 'b-completed-1',
      rating: 5,
      comment: 'Exceptional quality and natural light.',
      authorName: 'Aanya',
      createdAt: new Date().toISOString(),
    });

    fireEvent.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/bookings/b-completed-1/review', {
        rating: 5,
        comment: 'Exceptional quality and natural light.',
      });
    });
  });

  it('privacy enforcement: owner FIRST NAME only is rendered, strictly NO email or phone', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      if (url === '/api/bookings/b-confirmed-1') return Promise.resolve(mockBookingConfirmed);
      return Promise.resolve(null);
    });

    renderWithProviders(
      <Routes>
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
      </Routes>,
      { route: '/bookings/b-confirmed-1' }
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Terracotta Workshop Studio' })).toBeInTheDocument();

    // Host first name "Kavita" is displayed (from "Kavita Sundaram")
    expect(screen.getByText(/hosted by kavita/i)).toBeInTheDocument();

    // Strictly check whole page content for email and phone numbers
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/sundaram@/i);
    expect(html).not.toMatch(/\+91/);
    expect(html).not.toMatch(/devendra@/i);
  });

  it('renders 404 state when booking does not exist or does not belong to the user', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockCustomerProfile);
      if (url === '/api/bookings/b-unauthorized') {
        return Promise.reject(new ApiError('NOT_FOUND', 'Booking not found', null, 404));
      }
      return Promise.resolve(null);
    });

    renderWithProviders(
      <Routes>
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
      </Routes>,
      { route: '/bookings/b-unauthorized' }
    );

    expect(await screen.findByRole('heading', { level: 2, name: /reservation not found/i })).toBeInTheDocument();
    expect(screen.getByText(/you do not have permission to inspect its records/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to my bookings/i })).toBeInTheDocument();
  });
});
