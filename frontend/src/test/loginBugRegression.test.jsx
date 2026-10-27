import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { ProtectedRoute } from '../routes/guards';
import { PublicLayout } from '../components/layout/PublicLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { supabase } from '../lib/supabase';
import { api, ApiError } from '../api/client';

// Mock Supabase client
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

// Mock API client
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    upload: vi.fn(),
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

function ContextInspector() {
  const { user, profile, isAuthenticated } = useAuth();
  return (
    <div data-testid="context-inspector">
      <span data-testid="ctx-user-email">{user?.email || 'no-user'}</span>
      <span data-testid="ctx-profile-name">{profile?.name || 'no-profile'}</span>
      <span data-testid="ctx-authenticated">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</span>
    </div>
  );
}

function renderTestApp({ initialRoute = '/login' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <ContextInspector />
          <Routes>
            {/* Public Layout Routes with Navbar */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<div>Home Landing Page</div>} />
              <Route path="/explore" element={<div>Explore Spaces Page</div>} />
              <Route
                path="/owner/dashboard"
                element={
                  <ProtectedRoute>
                    <div data-testid="protected-content">Secret Owner Dashboard</div>
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Login Bug Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes user and profile, shows account menu in navbar, and renders protected route after successful sign-in', async () => {
    const mockUser = {
      id: 'usr-101',
      email: 'steward@nexora.com',
    };

    const mockSession = {
      access_token: 'valid-jwt-token-123',
      user: mockUser,
    };

    const mockProfile = {
      id: 'usr-101',
      name: 'Rohan Joshi',
      email: 'steward@nexora.com',
      role: 'OWNER',
      is_active: true,
    };

    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: mockUser, session: mockSession },
      error: null,
    });

    api.get.mockImplementation(async (url) => {
      if (url === '/api/auth/me') {
        return mockProfile;
      }
      return null;
    });

    renderTestApp({ initialRoute: '/login' });

    // Fill in email and password
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'steward@nexora.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'SecretPassword123!' },
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Verify context state updates
    await waitFor(() => {
      expect(screen.getByTestId('ctx-user-email')).toHaveTextContent('steward@nexora.com');
      expect(screen.getByTestId('ctx-profile-name')).toHaveTextContent('Rohan Joshi');
      expect(screen.getByTestId('ctx-authenticated')).toHaveTextContent('authenticated');
    });

    // Verify navbar: shows account menu button instead of "Log in" and renders protected route
    await waitFor(() => {
      const header = screen.getByRole('banner');
      expect(within(header).getByLabelText(/account menu/i)).toBeInTheDocument();
      expect(within(header).queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('protected-content')).toHaveTextContent('Secret Owner Dashboard');
    });
  });

  it('displays clear error message and retry button when /api/auth/me fails, preventing silent logged-out redirect', async () => {
    const mockUser = {
      id: 'usr-102',
      email: 'customer@nexora.com',
    };

    const mockSession = {
      access_token: 'token-456',
      user: mockUser,
    };

    const mockProfile = {
      id: 'usr-102',
      name: 'Aditi Sharma',
      email: 'customer@nexora.com',
      role: 'CUSTOMER',
      is_active: true,
    };

    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });

    // Fail the initial profile fetch
    api.get.mockRejectedValueOnce(
      new ApiError('PROFILE_FETCH_FAILED', 'Failed to retrieve user profile from backend authority', null, 500)
    );

    renderTestApp({ initialRoute: '/login' });

    // Fill in credentials
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'customer@nexora.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Password123!' },
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // User should NOT be silently redirected to /explore
    // Instead, they should see a clear error alert on /login
    await waitFor(() => {
      expect(screen.getByText(/Failed to retrieve user profile from backend authority/i)).toBeInTheDocument();
    });

    // The user sees a clear "Retry" button
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    // The user is still on the login page (Sign In button is still present)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByTestId('ctx-authenticated')).toHaveTextContent('unauthenticated');

    // Now mock profile to succeed on retry
    api.get.mockResolvedValueOnce(mockProfile);

    // Click retry
    fireEvent.click(retryButton);

    // Now sign in succeeds and context becomes authenticated
    await waitFor(() => {
      expect(screen.getByTestId('ctx-authenticated')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('ctx-profile-name')).toHaveTextContent('Aditi Sharma');
    });
  });
});
