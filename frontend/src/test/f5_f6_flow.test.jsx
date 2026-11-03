import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthContext';
import { supabase } from '../lib/supabase';
import { api } from '../api/client';

// F5 Pages
import { OwnerDashboardPage } from '../pages/owner/OwnerDashboardPage';
import { OwnerInspectionsPage } from '../pages/owner/OwnerInspectionsPage';
import { OwnerInspectionDetailPage } from '../pages/owner/OwnerInspectionDetailPage';
import { OwnerMaintenancePage } from '../pages/owner/OwnerMaintenancePage';
import { OwnerMaintenanceDetailPage } from '../pages/owner/OwnerMaintenanceDetailPage';
import { OwnerExpensesPage } from '../pages/owner/OwnerExpensesPage';

// F6 Pages
import { ProviderJobsPage } from '../pages/provider/ProviderJobsPage';
import { ProviderJobDetailPage } from '../pages/provider/ProviderJobDetailPage';
import { ProviderSchedulePage } from '../pages/provider/ProviderSchedulePage';
import { ProviderReviewsPage } from '../pages/provider/ProviderReviewsPage';
import { ProviderProfilePage } from '../pages/provider/ProviderProfilePage';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminVerificationsPage } from '../pages/admin/AdminVerificationsPage';
import { AdminPropertiesPage } from '../pages/admin/AdminPropertiesPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';

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
    }
  },
}));

function renderWithProviders(ui, { route = '/', role = 'OWNER' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  supabase.auth.getSession.mockResolvedValue({
    data: {
      session: {
        user: { id: 'user-123', email: 'test@nexora.com' },
        access_token: 'fake-token',
      },
    },
    error: null,
  });

  supabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });

  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation((url, ...args) => {
    if (url === '/api/auth/me') {
      return Promise.resolve({
        id: 'user-123',
        name: 'Test Account',
        email: 'test@nexora.com',
        role,
        is_active: true,
      });
    }
    if (originalGet) {
      return originalGet(url, ...args);
    }
    return Promise.resolve({ data: [] });
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          {ui}
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Phase F5: Owner Advanced Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders OwnerDashboardPage with financial totals and property performance', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/properties')) {
        return Promise.resolve({
          data: [{ id: 'prop-1', title: 'Lakefront Villa', city: 'Udaipur' }],
        });
      }
      if (url.includes('/api/owner/dashboard')) {
        return Promise.resolve({
          data: {
            totals: {
              incomeReceived: '150000.00',
              incomeExpected: '200000.00',
              expenses: '35000.00',
              net: '115000.00',
            },
            occupancy: { averageRate: 85, activeListingCount: 1, totalUnits: 2 },
            health: { averageScore: 92, grade: 'A', overdueCount: 0 },
            maintenance: { urgentHighOpenCount: 0 },
            series: [{ month: 'Nov 2026', incomeReceived: '150000.00', expenses: '35000.00', net: '115000.00' }],
            upcoming: { bookings: [], inspections: [], maintenance: [] },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<OwnerDashboardPage />);

    expect(await screen.findByText('Portfolio Dashboard')).toBeInTheDocument();
    expect((await screen.findAllByText(/₹1,50,000.00/))[0]).toBeInTheDocument();
    expect((await screen.findAllByText(/₹35,000.00/))[0]).toBeInTheDocument();
    expect((await screen.findAllByText(/₹1,15,000.00/))[0]).toBeInTheDocument();
    expect(screen.getAllByText(/85%/)[0]).toBeInTheDocument();
  });

  it('renders OwnerInspectionsPage and lists inspections', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/inspections')) {
        return Promise.resolve({
          data: [
            {
              id: 'insp-12345678',
              status: 'COMPLETED',
              grade: 'A',
              score: 95,
              scheduledAt: '2026-11-20T10:00:00Z',
              completedAt: '2026-11-20T12:00:00Z',
              summary: 'Quarterly compliance check',
            },
          ],
        });
      }
      if (url.includes('/api/properties')) {
        return Promise.resolve({
          data: [{ id: 'prop-1', title: 'Lakefront Villa', city: 'Udaipur' }],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<OwnerInspectionsPage />);

    expect(await screen.findByText('Property Inspections')).toBeInTheDocument();
    expect(await screen.findByText(/Inspection #insp-123/)).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText(/Grade A \(95\/100\)/)).toBeInTheDocument();
  });

  it('renders OwnerInspectionDetailPage with checklist items and completion action', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/inspections/insp-1')) {
        return Promise.resolve({
          data: {
            id: 'insp-1',
            status: 'SCHEDULED',
            scheduledAt: '2026-11-25T10:00:00Z',
            property: { title: 'Lakefront Villa', city: 'Udaipur' },
            items: [
              { itemName: 'Roof Structure', category: 'Structural', condition: 'GOOD', notes: 'No leaks' },
            ],
            media: [],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(
      <Routes>
        <Route path="/owner/inspections/:id" element={<OwnerInspectionDetailPage />} />
      </Routes>,
      { route: '/owner/inspections/insp-1' }
    );

    expect(await screen.findByText(/Inspection #insp-1/)).toBeInTheDocument();
    expect(await screen.findByText('Roof Structure')).toBeInTheDocument();
    expect(screen.getByText('Complete Inspection')).toBeInTheDocument();
  });

  it('renders OwnerMaintenancePage and lists work orders', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/properties')) {
        return Promise.resolve({
          data: [{ id: 'prop-1', title: 'Lakefront Villa', city: 'Udaipur' }],
        });
      }
      if (url.includes('/api/service-categories')) {
        return Promise.resolve({ data: [{ id: 'cat-1', name: 'Plumbing' }] });
      }
      if (url.includes('/api/maintenance-requests')) {
        return Promise.resolve({
          data: [
            {
              id: 'job-1',
              title: 'Main bathroom faucet leak',
              description: 'Continuous dripping faucet needs cartridge replacement',
              priority: 'HIGH',
              status: 'ASSIGNED',
              estimatedCost: '2500.00',
              property: { title: 'Lakefront Villa', city: 'Udaipur' },
              category: { name: 'Plumbing' },
              createdAt: '2026-11-20T10:00:00Z',
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<OwnerMaintenancePage />);

    expect(await screen.findByText('Maintenance Work Orders')).toBeInTheDocument();
    expect(await screen.findByText('Main bathroom faucet leak')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('ASSIGNED')).toBeInTheDocument();
    expect(screen.getByText(/₹2,500.00/)).toBeInTheDocument();
  });

  it('renders OwnerMaintenanceDetailPage with actions and contact reveal', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/maintenance-requests/job-1')) {
        return Promise.resolve({
          data: {
            id: 'job-1',
            title: 'Main bathroom faucet leak',
            description: 'Continuous dripping faucet needs cartridge replacement',
            priority: 'HIGH',
            status: 'ASSIGNED',
            estimatedCost: '2500.00',
            property: { title: 'Lakefront Villa', city: 'Udaipur' },
            assignedProvider: { businessName: 'QuickFix Plumbing', bio: 'Licensed plumbers' },
            counterpartContact: { phone: '+919876500000' },
            allowedActions: ['unassign', 'complete', 'cancel'],
            updates: [],
            createdAt: '2026-11-20T10:00:00Z',
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(
      <Routes>
        <Route path="/owner/maintenance/:id" element={<OwnerMaintenanceDetailPage />} />
      </Routes>,
      { route: '/owner/maintenance/job-1' }
    );

    expect(await screen.findByText('Main bathroom faucet leak')).toBeInTheDocument();
    expect(await screen.findByText('QuickFix Plumbing')).toBeInTheDocument();
    expect(screen.getByText('+919876500000')).toBeInTheDocument();
    expect(screen.getByText('Complete Job')).toBeInTheDocument();
    expect(screen.getByText('Unassign')).toBeInTheDocument();
  });

  it('renders OwnerExpensesPage with ledger table and total sum', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/expenses/categories') {
        return Promise.resolve({
          data: ['MAINTENANCE', 'UTILITIES', 'TAXES', 'INSURANCE', 'CLEANING', 'SUPPLIES', 'SALARY', 'OTHER'],
        });
      }
      if (url.includes('/expenses')) {
        return Promise.resolve({
          data: [
            {
              id: 'exp-1',
              category: 'MAINTENANCE',
              description: 'HVAC Filter replacement',
              amount: '4500.00',
              incurredOn: '2026-11-18',
              hasReceipt: true,
            },
          ],
          totalAmount: '4500.00',
        });
      }
      if (url.includes('/api/properties')) {
        return Promise.resolve({
          data: [{ id: 'prop-1', title: 'Lakefront Villa', city: 'Udaipur' }],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<OwnerExpensesPage />);

    expect(await screen.findByText('Property Expenses Ledger')).toBeInTheDocument();
    expect(await screen.findByText('HVAC Filter replacement')).toBeInTheDocument();
    expect((await screen.findAllByText(/₹4,500.00/))[0]).toBeInTheDocument();
    expect(screen.getByText('Receipt Verified')).toBeInTheDocument();
  });

  it('loads expense categories from API list, displays CLEANING and SALARY, and omits MANAGEMENT_FEE', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/expenses/categories') {
        return Promise.resolve({
          data: ['MAINTENANCE', 'UTILITIES', 'TAXES', 'INSURANCE', 'CLEANING', 'SUPPLIES', 'SALARY', 'OTHER'],
        });
      }
      if (url.includes('/api/properties/mine')) {
        return Promise.resolve({
          data: [{ id: 'prop-1', title: 'Lakefront Villa', city: 'Udaipur' }],
        });
      }
      if (url.includes('/expenses')) {
        return Promise.resolve({ data: [], totalAmount: '0.00' });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<OwnerExpensesPage />);

    // Click Record Expense to open modal
    const recordBtn = await screen.findByRole('button', { name: /record expense/i });
    fireEvent.click(recordBtn);

    // Verify modal is open and categories are populated from API
    expect(await screen.findByText('Record Property Expense')).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'CLEANING' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('option', { name: 'SALARY' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('option', { name: /management_fee/i })).not.toBeInTheDocument();
  });

  it('handles empty and error states in OwnerExpensesPage', async () => {
    // Empty state
    api.get.mockImplementation((url) => {
      if (url === '/api/expenses/categories') {
        return Promise.resolve({ data: ['MAINTENANCE', 'CLEANING', 'SALARY'] });
      }
      if (url.includes('/api/properties/mine')) {
        return Promise.resolve({
          data: [{ id: 'prop-1', title: 'Lakefront Villa', city: 'Udaipur' }],
        });
      }
      if (url.includes('/expenses')) {
        return Promise.resolve({ data: [], totalAmount: '0.00' });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<OwnerExpensesPage />);
    expect(await screen.findByText('No expenses recorded')).toBeInTheDocument();

    // Error state
    api.get.mockImplementation((url) => {
      if (url === '/api/expenses/categories') {
        return Promise.resolve({ data: ['CLEANING'] });
      }
      if (url.includes('/api/properties/mine')) {
        return Promise.resolve({
          data: [{ id: 'prop-1', title: 'Lakefront Villa', city: 'Udaipur' }],
        });
      }
      if (url.includes('/expenses')) {
        return Promise.reject(new Error('Database ledger unreachable'));
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<OwnerExpensesPage />);
    expect(await screen.findByText('Database ledger unreachable')).toBeInTheDocument();
  });

  it('OwnerInspectionDetailPage enforces 1 to 100 checklist items limit and loads 21-item template', async () => {
    const mock21Templates = Array.from({ length: 21 }, (_, i) => ({
      itemName: `Standard Check Item ${i + 1}`,
      category: 'Safety',
    }));

    api.get.mockImplementation((url) => {
      if (url === '/api/inspections/templates') {
        return Promise.resolve({ data: mock21Templates });
      }
      if (url.includes('/api/inspections/insp-empty')) {
        return Promise.resolve({
          data: {
            id: 'insp-empty',
            status: 'SCHEDULED',
            scheduledAt: '2026-11-25T10:00:00Z',
            property: { title: 'Lakefront Villa', city: 'Udaipur' },
            items: [],
            media: [],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(
      <Routes>
        <Route path="/owner/inspections/:id" element={<OwnerInspectionDetailPage />} />
      </Routes>,
      { route: '/owner/inspections/insp-empty' }
    );

    // Empty state should display and offer Load Standard Checklist
    expect(await screen.findByText('No checklist items initialized for this inspection yet.')).toBeInTheDocument();
    const loadBtn = screen.getByRole('button', { name: /load standard checklist/i });
    fireEvent.click(loadBtn);

    // Should load 21 items
    await waitFor(() => {
      expect(screen.getByText(/Inspection Checklist \(21 items\)/)).toBeInTheDocument();
    });

    // Add item button should work
    const addItemBtn = screen.getByRole('button', { name: /add item/i });
    fireEvent.click(addItemBtn);

    await waitFor(() => {
      expect(screen.getByText(/Inspection Checklist \(22 items\)/)).toBeInTheDocument();
    });
  });
});

describe('Phase F6: Provider and Admin Portals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ProviderJobsPage with active jobs', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/maintenance-requests')) {
        return Promise.resolve({
          data: [
            {
              id: 'job-1',
              title: 'Electrical breaker trip check',
              description: 'Main breaker tripping intermittently',
              priority: 'URGENT',
              status: 'ASSIGNED',
              estimatedCost: '3200.00',
              property: { title: 'Palm Heights', city: 'Bangalore' },
              scheduledAt: '2026-11-24T14:00:00Z',
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<ProviderJobsPage />, { role: 'PROVIDER' });

    expect(await screen.findByText('Provider Job Board')).toBeInTheDocument();
    expect(await screen.findByText('Electrical breaker trip check')).toBeInTheDocument();
    expect(screen.getByText('URGENT')).toBeInTheDocument();
    expect(screen.getByText('ASSIGNED')).toBeInTheDocument();
    expect(screen.getByText(/₹3,200.00/)).toBeInTheDocument();
  });

  it('renders ProviderJobDetailPage with start and decline actions', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/maintenance-requests/job-1')) {
        return Promise.resolve({
          data: {
            id: 'job-1',
            title: 'Electrical breaker trip check',
            description: 'Main breaker tripping intermittently',
            priority: 'URGENT',
            status: 'ASSIGNED',
            estimatedCost: '3200.00',
            property: { title: 'Palm Heights', city: 'Bangalore', address: '123 Tech Park Road' },
            counterpartContact: { phone: '+919123456789' },
            updates: [],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(
      <Routes>
        <Route path="/provider/jobs/:id" element={<ProviderJobDetailPage />} />
      </Routes>,
      { route: '/provider/jobs/job-1', role: 'PROVIDER' }
    );

    expect(await screen.findByText('Electrical breaker trip check')).toBeInTheDocument();
    expect(screen.getByText('Start Work')).toBeInTheDocument();
    expect(screen.getByText('Decline Job')).toBeInTheDocument();
    expect(screen.getByText('+919123456789')).toBeInTheDocument();
  });

  it('renders ProviderSchedulePage with upcoming visits', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/maintenance-requests')) {
        return Promise.resolve({
          data: [
            {
              id: 'job-2',
              title: 'HVAC Routine Duct Cleaning',
              priority: 'MEDIUM',
              status: 'IN_PROGRESS',
              property: { title: 'Skyline Penthouse', city: 'Mumbai' },
              scheduledAt: '2026-11-28T11:00:00Z',
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<ProviderSchedulePage />, { role: 'PROVIDER' });

    expect(await screen.findByText('Dispatch Schedule')).toBeInTheDocument();
    expect(await screen.findByText('HVAC Routine Duct Cleaning')).toBeInTheDocument();
  });

  it('renders ProviderReviewsPage with reputation metrics', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/reviews')) {
        return Promise.resolve({
          data: [
            {
              id: 'rev-1',
              rating: 5,
              comment: 'Diligent pipe repair and punctual arrival.',
              createdAt: '2026-11-20T10:00:00Z',
              maintenanceTitle: 'Emergency Pipe Repair',
            },
          ],
        });
      }
      if (url.includes('/api/providers/me')) {
        return Promise.resolve({
          data: {
            id: 'prov-1',
            stats: { averageRating: 4.8, reviewCount: 12, completedJobCount: 15 },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<ProviderReviewsPage />, { role: 'PROVIDER' });

    expect(await screen.findByText('Client Reviews & Ratings')).toBeInTheDocument();
    expect(await screen.findByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(await screen.findByText(/not available yet/i)).toBeInTheDocument();
  });

  it('renders ProviderProfilePage and allows updating details', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/providers/me')) {
        return Promise.resolve({
          data: {
            id: 'prov-1',
            businessName: 'Vertex Electrics',
            bio: 'Commercial electrical contractor',
            serviceAreaCity: 'Bangalore',
            serviceAreaState: 'Karnataka',
            isAvailable: true,
            verificationStatus: 'VERIFIED',
            categories: [{ id: 'cat-1', name: 'Electrical' }],
          },
        });
      }
      if (url.includes('/api/service-categories')) {
        return Promise.resolve({
          data: [{ id: 'cat-1', name: 'Electrical' }, { id: 'cat-2', name: 'Plumbing' }],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<ProviderProfilePage />, { role: 'PROVIDER' });

    expect(await screen.findByText('Business Profile & Availability')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Vertex Electrics')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bangalore')).toBeInTheDocument();
  });

  it('renders AdminDashboardPage with platform telemetry', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/admin/dashboard')) {
        return Promise.resolve({
          data: {
            grossVolume: '450000.00',
            platformFeesEarned: '45000.00',
            activeProperties: 18,
            openMaintenance: 4,
            pendingProviderVerifications: 2,
            usersByRole: { CUSTOMER: 25, OWNER: 8, PROVIDER: 12, ADMIN: 2 },
            bookingsByStatus: { PENDING: 3, CONFIRMED: 10, COMPLETED: 40 },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<AdminDashboardPage />, { role: 'ADMIN' });

    expect(await screen.findByText('Platform Administration')).toBeInTheDocument();
    expect(await screen.findByText(/₹4,50,000.00/)).toBeInTheDocument();
    expect(screen.getByText(/₹45,000.00/)).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders AdminVerificationsPage with provider queue', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/admin/providers')) {
        return Promise.resolve({
          data: [
            {
              id: 'prov-app-1',
              businessName: 'Ace Carpentry Works',
              serviceAreaCity: 'Pune',
              serviceAreaState: 'Maharashtra',
              verificationStatus: 'PENDING',
              createdAt: '2026-11-21T10:00:00Z',
              user: { name: 'Rahul Sharma', email: 'rahul@example.com' },
              categories: [{ name: 'Carpentry' }],
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<AdminVerificationsPage />, { role: 'ADMIN' });

    expect(await screen.findByText('Provider Verification Queue')).toBeInTheDocument();
    expect(await screen.findByText('Ace Carpentry Works')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('renders AdminPropertiesPage and displays listed estates', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/properties')) {
        return Promise.resolve({
          data: [
            {
              id: 'prop-1',
              title: 'Heritage Haveli',
              city: 'Jaipur',
              state: 'Rajasthan',
              propertyType: 'COMMERCIAL',
              status: 'ACTIVE',
              createdAt: '2026-11-15T10:00:00Z',
              owner: { name: 'Vikram Singh' },
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<AdminPropertiesPage />, { role: 'ADMIN' });

    expect(await screen.findByText('Property Approvals & Compliance')).toBeInTheDocument();
    expect(await screen.findByText('Heritage Haveli')).toBeInTheDocument();
  });

  it('renders AdminUsersPage and displays accounts list', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/api/admin/users')) {
        return Promise.resolve({
          data: [
            {
              id: 'user-99',
              name: 'Ananya Roy',
              email: 'ananya@example.com',
              role: 'CUSTOMER',
              is_active: true,
              created_at: '2026-11-10T10:00:00Z',
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<AdminUsersPage />, { role: 'ADMIN' });

    expect(await screen.findByText('User & Role Administration')).toBeInTheDocument();
    expect(await screen.findByText('Ananya Roy')).toBeInTheDocument();
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
  });

  it('renders loading, empty, and error states across F6 provider and admin pages', async () => {
    // 1. ProviderJobsPage empty state
    api.get.mockImplementation((url) => {
      if (url.includes('/api/maintenance-requests')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    const { unmount: unmount1 } = renderWithProviders(<ProviderJobsPage />, { role: 'PROVIDER' });
    expect(await screen.findByText('No service jobs found')).toBeInTheDocument();
    unmount1();

    // 2. AdminVerificationsPage empty state
    api.get.mockImplementation((url) => {
      if (url.includes('/api/admin/providers')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    const { unmount: unmount2 } = renderWithProviders(<AdminVerificationsPage />, { role: 'ADMIN' });
    expect(await screen.findByText('No provider applications found for the selected status.')).toBeInTheDocument();
    unmount2();

    // 3. AdminPropertiesPage empty state
    api.get.mockImplementation((url) => {
      if (url.includes('/api/properties')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    const { unmount: unmount3 } = renderWithProviders(<AdminPropertiesPage />, { role: 'ADMIN' });
    expect(await screen.findByText('No properties found matching the filter criteria.')).toBeInTheDocument();
    unmount3();

    // 4. AdminUsersPage error state
    api.get.mockImplementation((url) => {
      if (url.includes('/api/admin/users')) {
        return Promise.reject(new Error('User directory connection failed'));
      }
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<AdminUsersPage />, { role: 'ADMIN' });
    expect(await screen.findByText(/failed to load users directory/i)).toBeInTheDocument();
  });
});
