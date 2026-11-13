import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthContext';
import { ToastProvider } from '../components/ui/Toast';
import { RoleRoute } from '../routes/guards';
import { MoneyInput } from '../components/owner/MoneyInput';
import { ImageUploader } from '../components/owner/ImageUploader';
import { ListPropertyPage } from '../pages/owner/ListPropertyPage';
import { OwnerPropertiesPage } from '../pages/owner/OwnerPropertiesPage';
import { OwnerPropertyDetailPage } from '../pages/owner/OwnerPropertyDetailPage';
import { OwnerBookingsPage } from '../pages/owner/OwnerBookingsPage';
import { OwnerBookingDetailPage } from '../pages/owner/OwnerBookingDetailPage';
import { supabase } from '../lib/supabase';
import { api, ApiError } from '../api/client';

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
    constructor(code, message, details = null, status = 500) {
      super(message || 'An unexpected error occurred');
      this.name = 'ApiError';
      this.code = code || 'INTERNAL_ERROR';
      this.details = details;
      this.status = status;
      this.data = { code };
    }
  },
}));

const mockOwnerProfile = {
  id: 'owner-1',
  name: 'Estate Owner',
  email: 'owner@nexora.com',
  role: 'OWNER',
  phone: '+919876543210',
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

describe('Owner Flow Unit and Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: mockOwnerProfile.id, email: mockOwnerProfile.email }, access_token: 'fake-jwt' } },
      error: null,
    });

    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    api.get.mockImplementation((url) => {
      if (url === '/api/auth/me') return Promise.resolve(mockOwnerProfile);
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MoneyInput Component', () => {
    it('renders with rupee symbol prefix and formats input', () => {
      const onChange = vi.fn();
      const { container } = render(<MoneyInput value="1500" onChange={onChange} id="test-price" />);

      const input = container.querySelector('#test-price');
      expect(input).toBeInTheDocument();
      expect(screen.getByText('₹')).toBeInTheDocument();

      fireEvent.change(input, { target: { value: '2500.50' } });
      expect(onChange).toHaveBeenCalledWith('2500.50');
    });

    it('restricts input to numbers with maximum 2 decimal places', () => {
      const onChange = vi.fn();
      const { container } = render(<MoneyInput value="100" onChange={onChange} id="test-price-2" />);

      const input = container.querySelector('#test-price-2');
      fireEvent.change(input, { target: { value: '100.999' } });
      expect(onChange).toHaveBeenCalledWith('100.99');

      onChange.mockClear();
      fireEvent.change(input, { target: { value: 'abc' } });
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('ImageUploader Component', () => {
    it('rejects files larger than 5MB', () => {
      const onImagesChange = vi.fn();
      render(<ImageUploader images={[]} onImagesChange={onImagesChange} />);

      const oversizedFile = new File(['x'.repeat(6 * 1024 * 1024)], 'giant.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

      expect(screen.getByText(/Maximum allowed file size is 5 MB/i)).toBeInTheDocument();
      expect(onImagesChange).not.toHaveBeenCalled();
    });

    it('rejects unsupported file formats like SVG or text', () => {
      const onImagesChange = vi.fn();
      render(<ImageUploader images={[]} onImagesChange={onImagesChange} />);

      const svgFile = new File(['<svg></svg>'], 'badge.svg', { type: 'image/svg+xml' });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [svgFile] } });

      expect(screen.getByText(/Please upload JPEG, PNG, or WebP images only/i)).toBeInTheDocument();
      expect(onImagesChange).not.toHaveBeenCalled();
    });

    it('enforces maximum 10 images limit', () => {
      const existingImages = Array.from({ length: 10 }, (_, i) => ({
        id: `img-${i}`,
        url: `https://example.com/photo-${i}.jpg`,
        isCover: i === 0,
        sortOrder: i,
      }));

      const onImagesChange = vi.fn();
      render(<ImageUploader images={existingImages} onImagesChange={onImagesChange} />);

      const eleventhFile = new File(['data'], 'new.jpg', { type: 'image/jpeg' });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [eleventhFile] } });

      expect(screen.getByText(/Maximum limit of 10 photos reached/i)).toBeInTheDocument();
      expect(onImagesChange).not.toHaveBeenCalled();
    });
  });

  describe('ListPropertyPage Wizard & Draft Recovery', () => {
    it('restores draft data from sessionStorage on mount', () => {
      sessionStorage.setItem(
        'nexora:property_draft',
        JSON.stringify({
          title: 'Saved Coastal Villa',
          description: 'A coastal beach retreat',
          propertyType: 'VILLA',
          addressLine1: '42 Shoreline Road',
          city: 'Goa',
          state: 'Goa',
          postalCode: '403001',
          category: 'COASTAL',
          rules: '',
        })
      );

      renderWithProviders(<ListPropertyPage />);

      expect(screen.getByDisplayValue('Saved Coastal Villa')).toBeInTheDocument();
    });

    it('shows validation errors when advancing to step 2 with empty required fields', async () => {
      renderWithProviders(<ListPropertyPage />);

      const nextButton = screen.getByRole('button', { name: /Next Step/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/Title must be at least 3 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Owner Properties Page', () => {
    it('renders list of properties and supports status filtering', async () => {
      const mockProperties = [
        {
          id: 'prop-1',
          title: 'Heritage Courtyard Villa',
          city: 'Jaipur',
          state: 'Rajasthan',
          status: 'ACTIVE',
          propertyType: 'HERITAGE',
          spaces: [{ id: 's1', name: 'Courtyard Suite' }],
          media: [{ id: 'm1', url: 'https://example.com/p1.jpg', isCover: true }],
        },
      ];

      api.get.mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve(mockOwnerProfile);
        if (url.includes('/api/properties')) {
          return Promise.resolve({ data: mockProperties, meta: { total: 1, totalPages: 1 } });
        }
        return Promise.resolve({ data: [] });
      });

      renderWithProviders(<OwnerPropertiesPage />);

      await waitFor(() => {
        expect(screen.getByText('Heritage Courtyard Villa')).toBeInTheDocument();
        expect(screen.getByText(/Jaipur, Rajasthan/i)).toBeInTheDocument();
      });
    });
  });

  describe('Owner Property Detail & Active Bookings Safeguard', () => {
    it('maps HAS_ACTIVE_BOOKINGS error to a descriptive message when attempting to archive or delete', async () => {
      const mockProperty = {
        id: 'prop-1',
        title: 'Modern Mountain Loft',
        city: 'Manali',
        state: 'Himachal Pradesh',
        addressLine1: 'Log Huts Area',
        postalCode: '175131',
        status: 'ACTIVE',
        propertyType: 'CHALET',
        description: 'Charming mountain view loft',
        spaces: [
          {
            id: 'space-1',
            name: 'Loft Studio',
            spaceType: 'STUDIO',
            capacity: 4,
            priceAmount: '5000.00',
            priceUnit: 'DAY',
            isActive: true,
          },
        ],
        property_media: [],
      };

      api.get.mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve(mockOwnerProfile);
        if (url === '/api/properties/prop-1') {
          return Promise.resolve({ data: mockProperty });
        }
        if (url.includes('/api/owner/bookings')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      api.delete.mockRejectedValue(
        new ApiError('HAS_ACTIVE_BOOKINGS', 'Cannot delete property with active bookings', null, 409)
      );

      renderWithProviders(
        <Routes>
          <Route path="/owner/properties/:id" element={<OwnerPropertyDetailPage />} />
        </Routes>,
        { route: '/owner/properties/prop-1' }
      );

      await waitFor(() => {
        expect(screen.getByText('Modern Mountain Loft')).toBeInTheDocument();
      });

      const openButton = screen.getByRole('button', { name: /Remove Listing/i });
      fireEvent.click(openButton);

      // Wait for sheet to appear and click confirm
      const buttons = await screen.findAllByRole('button', { name: /Remove Listing/i });
      fireEvent.click(buttons[1]);

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith('/api/properties/prop-1');
      });

      await waitFor(() => {
        expect(
          screen.getByText(/This property cannot be removed because it has active or future bookings/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Owner Bookings Management & Privacy Invariants', () => {
    it('strictly exposes customer name and phone only, with NO email displayed', async () => {
      const mockBooking = {
        id: 'booking-101',
        startAt: '2026-12-01T10:00:00.000Z',
        endAt: '2026-12-01T14:00:00.000Z',
        guestCount: 3,
        status: 'PENDING',
        totalAmount: '4500.00',
        subtotal: '4000.00',
        platformFee: '400.00',
        ownerAmount: '3600.00',
        paidAmount: '0.00',
        customer: {
          id: 'cust-1',
          name: 'Priya Sharma',
          phone: '+919811122233',
        },
        space: {
          id: 'sp-1',
          name: 'Garden Terrace Studio',
          coverImageUrl: 'https://example.com/terrace.jpg',
          property: {
            id: 'pr-1',
            title: 'Terrace Residency',
            city: 'Bengaluru',
          },
        },
      };

      api.get.mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve(mockOwnerProfile);
        if (url.includes('/api/owner/bookings')) {
          return Promise.resolve({ data: [mockBooking], meta: { total: 1, totalPages: 1 } });
        }
        if (url.includes('/api/properties')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });

      renderWithProviders(<OwnerBookingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
        expect(screen.getByText('+919811122233')).toBeInTheDocument();
      });

      // Strict privacy check: email MUST NOT be present
      expect(screen.queryByText(/@/)).toBeNull();
      expect(screen.queryByText(/priya@/i)).toBeNull();
    });

    it('triggers status update mutation when confirming a booking request', async () => {
      const mockBooking = {
        id: 'b-pending-1',
        startAt: '2026-12-05T09:00:00.000Z',
        endAt: '2026-12-05T17:00:00.000Z',
        guestCount: 2,
        status: 'PENDING',
        totalAmount: '2000.00',
        customer: { id: 'c-1', name: 'Arun Verma', phone: '+919998887776' },
        space: { name: 'Meeting Salon', property: { title: 'Downtown Offices', city: 'Mumbai' } },
      };

      api.get.mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({
            user: { id: 'owner-1' },
            profile: { id: 'owner-1', role: 'OWNER' },
          });
        }
        if (url.includes('/api/owner/bookings')) {
          return Promise.resolve({ data: [mockBooking], meta: { total: 1, totalPages: 1 } });
        }
        return Promise.resolve({ data: [] });
      });

      api.patch.mockResolvedValue({
        success: true,
        data: { booking: { id: 'b-pending-1', status: 'CONFIRMED' } },
      });

      renderWithProviders(<OwnerBookingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Arun Verma')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /^Confirm$/i });
      fireEvent.click(confirmButton);

      const sheetConfirmButton = screen.getByRole('button', { name: /Confirm Reservation/i });
      fireEvent.click(sheetConfirmButton);

      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith('/api/bookings/b-pending-1/status', {
          status: 'CONFIRMED',
          reason: undefined,
        });
      });
    });

    it('displays financial breakdown and respects allowedNextActions on detail page', async () => {
      const mockDetail = {
        id: 'b-detail-1',
        status: 'CONFIRMED',
        startAt: '2026-12-10T10:00:00.000Z',
        endAt: '2026-12-10T18:00:00.000Z',
        guestCount: 4,
        subtotal: '10000.00',
        platformFee: '1000.00',
        taxAmount: '1800.00',
        totalAmount: '11800.00',
        ownerAmount: '9000.00',
        paidAmount: '5000.00',
        customer: { id: 'c-2', name: 'Kavita Nair', phone: '+919123456789' },
        space: {
          id: 'sp-2',
          name: 'Sky Penthouse',
          spaceType: 'PENTHOUSE',
          capacity: 8,
          property: {
            title: 'Marina Heights',
            addressLine1: 'Ocean Drive',
            city: 'Kochi',
            state: 'Kerala',
          },
        },
        payments: [
          {
            id: 'pay-1',
            amount: '5000.00',
            currency: 'INR',
            paymentMethod: 'UPI',
            status: 'COMPLETED',
            transactionReference: 'UPI-TXN-9988',
            paidAt: '2026-11-23T08:00:00.000Z',
          },
        ],
        statusHistory: [
          {
            id: 'h-1',
            status: 'PENDING',
            changedBy: 'Kavita Nair',
            note: 'Initial request',
            changedAt: '2026-11-22T10:00:00.000Z',
          },
          {
            id: 'h-2',
            status: 'CONFIRMED',
            changedBy: 'Estate Owner',
            note: 'Approved by owner',
            changedAt: '2026-11-22T12:00:00.000Z',
          },
        ],
        allowedNextActions: ['cancel'],
      };

      api.get.mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve(mockOwnerProfile);
        if (url.includes('/api/bookings/')) {
          return Promise.resolve(mockDetail);
        }
        return Promise.resolve({ data: [] });
      });

      renderWithProviders(
        <Routes>
          <Route path="/owner/bookings/:id" element={<OwnerBookingDetailPage />} />
        </Routes>,
        { route: '/owner/bookings/b-detail-1' }
      );

      await waitFor(() => {
        expect(screen.getByText('Sky Penthouse')).toBeInTheDocument();
        expect(screen.getAllByText('Kavita Nair')[0]).toBeInTheDocument();
        expect(screen.getByText(/UPI-TXN-9988/)).toBeInTheDocument();
      });

      // Actions derived strictly from allowedNextActions:
      // 'cancel' is allowed, 'confirm', 'reject', and 'complete' are NOT allowed
      expect(screen.getByRole('button', { name: /Cancel Booking/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Confirm Booking/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Reject Request/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Mark as Completed/i })).toBeNull();
    });

    it('renders the owner booking detail with platformFee "500.00" and confirms no percent sign appears', async () => {
      const mockDetailWithFee = {
        id: 'b-fee-test',
        status: 'CONFIRMED',
        startAt: '2026-12-10T10:00:00.000Z',
        endAt: '2026-12-10T18:00:00.000Z',
        guestCount: 2,
        subtotal: '5000.00',
        platformFee: '500.00',
        taxAmount: '900.00',
        totalAmount: '5900.00',
        ownerAmount: '4500.00',
        paidAmount: '5900.00',
        customer: { id: 'c-3', name: 'Rohan Sharma', phone: '+919876543210' },
        space: {
          id: 'sp-3',
          name: 'Colab Studio',
          spaceType: 'STUDIO',
          capacity: 4,
          property: {
            title: 'Heritage Mill',
            addressLine1: 'Mills Lane',
            city: 'Mumbai',
            state: 'Maharashtra',
          },
        },
        payments: [],
        statusHistory: [],
        allowedNextActions: ['cancel'],
      };

      api.get.mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve(mockOwnerProfile);
        if (url.includes('/api/bookings/')) return Promise.resolve(mockDetailWithFee);
        return Promise.resolve({ data: [] });
      });

      renderWithProviders(
        <Routes>
          <Route path="/owner/bookings/:id" element={<OwnerBookingDetailPage />} />
        </Routes>,
        { route: '/owner/bookings/b-fee-test' }
      );

      await waitFor(() => {
        expect(screen.getByText('Colab Studio')).toBeInTheDocument();
        expect(screen.getByText('Financial Overview')).toBeInTheDocument();
      });

      // Verify platform fee amount is rendered
      expect(screen.getByText('-₹500.00')).toBeInTheDocument();
      expect(screen.getByText('Platform Fee')).toBeInTheDocument();

      // Confirm no percent sign appears in the financial overview container
      const financialSection = screen.getByText('Financial Overview').closest('.bg-card');
      expect(financialSection).toBeInTheDocument();
      expect(financialSection.textContent).not.toContain('%');
    });
  });

  describe('RoleRoute Navigation Guard', () => {
    it('blocks access to owner pages for CUSTOMER role', async () => {
      const mockCustomer = {
        id: 'cust-1',
        name: 'Aanya',
        role: 'CUSTOMER',
        is_active: true,
      };

      api.get.mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve(mockCustomer);
        return Promise.resolve({ data: [] });
      });

      renderWithProviders(
        <Routes>
          <Route
            path="/owner/properties"
            element={
              <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
                <div>Owner Secret Dashboard</div>
              </RoleRoute>
            }
          />
        </Routes>,
        { route: '/owner/properties', profile: mockCustomer }
      );

      await waitFor(() => {
        expect(screen.queryByText('Owner Secret Dashboard')).toBeNull();
        expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
      });
    });
  });
});
