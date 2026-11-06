import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthContext';
import { SignupPage } from '../pages/auth/SignupPage';
import { AuthCallbackPage } from '../pages/auth/AuthCallbackPage';
import { ExplorePage } from '../pages/explore/ExplorePage';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { supabase } from '../lib/supabase';
import { api } from '../api/client';

// Mock dependencies
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithOAuth: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      exchangeCodeForSession: vi.fn(),
    },
  },
}));

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

function renderWithProviders(ui, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Google Authentication Flow', () => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Google Sign-in Component', () => {
    it('renders "Continue with Google" button and invokes callback', async () => {
      const handleClick = vi.fn();
      render(<GoogleSignInButton onClick={handleClick} />);

      const googleBtn = await screen.findByRole('button', { name: /continue with google/i });
      expect(googleBtn).toBeInTheDocument();

      fireEvent.click(googleBtn);
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('Signup Page Google Sign-in with Role Preservation', () => {
    it('saves selected role in sessionStorage when Google signup is clicked', async () => {
      supabase.auth.signInWithOAuth.mockResolvedValueOnce({
        data: { provider: 'google', url: 'https://accounts.google.com/o/oauth2/v2/auth' },
        error: null,
      });

      renderWithProviders(<SignupPage />, { route: '/signup' });

      // Select "Property Steward" (OWNER) role
      const ownerRoleBtn = await screen.findByText(/property steward/i);
      fireEvent.click(ownerRoleBtn);

      const googleBtn = screen.getByRole('button', { name: /continue with google/i });
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              prompt: 'select_account',
            },
          },
        });
        expect(sessionStorage.getItem('nexora:pending_role')).toBe('OWNER');
      });
    });
  });

  describe('AuthCallbackPage', () => {
    it('redirects to role dashboard when session and profile resolve', async () => {
      const mockSession = {
        access_token: 'fake-google-jwt',
        user: { id: 'usr-google-1', email: 'owner@example.com' },
      };

      const mockProfile = {
        id: 'usr-google-1',
        name: 'Google Owner',
        role: 'OWNER',
        is_active: true,
      };

      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      api.get.mockResolvedValue(mockProfile);

      renderWithProviders(
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/owner/dashboard" element={<div>Owner Dashboard View</div>} />
        </Routes>,
        { route: '/auth/callback' }
      );

      expect(await screen.findByText('Owner Dashboard View')).toBeInTheDocument();
    });

    it('upgrades pending role from signup when user lands as CUSTOMER', async () => {
      sessionStorage.setItem('nexora:pending_role', 'PROVIDER');

      const mockSession = {
        access_token: 'fake-google-jwt',
        user: { id: 'usr-google-2', email: 'provider@example.com' },
      };

      const initialProfile = {
        id: 'usr-google-2',
        role: 'CUSTOMER',
        is_active: true,
      };

      const updatedProfile = {
        id: 'usr-google-2',
        role: 'PROVIDER',
        is_active: true,
      };

      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      api.get.mockResolvedValue(initialProfile);
      api.post.mockResolvedValue(updatedProfile);

      renderWithProviders(
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/provider/jobs" element={<div>Provider Jobs View</div>} />
        </Routes>,
        { route: '/auth/callback' }
      );

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/auth/me/role', { role: 'PROVIDER' });
      });

      expect(await screen.findByText('Provider Jobs View')).toBeInTheDocument();
      expect(sessionStorage.getItem('nexora:pending_role')).toBeNull();
    });

    it('renders friendly error message when OAuth returns access_denied', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>,
        { route: '/auth/callback?error=access_denied&error_description=User+declined' }
      );

      expect(await screen.findByText(/google sign-in was cancelled/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /return to sign in/i })).toBeInTheDocument();
      expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('renders account linking advice when email already exists', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>,
        { route: '/auth/callback?error=exchange_failed&error_description=Email+already+exists' }
      );

      expect(await screen.findByText('Account Already Exists')).toBeInTheDocument();
      expect(
        screen.getByText(/an account with this email address already exists/i)
      ).toBeInTheDocument();
      expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('bypasses exchangeCodeForSession when session is already present', async () => {
      const mockSession = {
        access_token: 'existing-session-token',
        user: { id: 'usr-existing', email: 'existing@example.com' },
      };
      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      api.get.mockResolvedValue({ id: 'usr-existing', role: 'CUSTOMER' });

      renderWithProviders(
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/explore" element={<div>Explore View</div>} />
        </Routes>,
        { route: '/auth/callback?code=already-exchanged-code' }
      );

      expect(await screen.findByText('Explore View')).toBeInTheDocument();
      expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
      expect(api.get).toHaveBeenCalledWith(
        '/api/auth/me',
        expect.objectContaining({ token: 'existing-session-token' })
      );
    });

    it('exchanges code for session when no initial session is present', async () => {
      const mockSession = {
        access_token: 'newly-exchanged-token',
        user: { id: 'usr-new', email: 'new@example.com' },
      };
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });
      supabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      api.get.mockResolvedValue({ id: 'usr-new', role: 'CUSTOMER' });

      renderWithProviders(
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/explore" element={<div>Explore View</div>} />
        </Routes>,
        { route: '/auth/callback?code=valid-pkce-code' }
      );

      expect(await screen.findByText('Explore View')).toBeInTheDocument();
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('valid-pkce-code');
      expect(api.get).toHaveBeenCalledWith(
        '/api/auth/me',
        expect.objectContaining({ token: 'newly-exchanged-token' })
      );
    });

    it('guards against double exchange when callback runs in StrictMode', async () => {
      const mockSession = {
        access_token: 'strict-mode-token',
        user: { id: 'usr-strict', email: 'strict@example.com' },
      };
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });
      supabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      api.get.mockResolvedValue({ id: 'usr-strict', role: 'CUSTOMER' });

      renderWithProviders(
        <React.StrictMode>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/explore" element={<div>Explore View</div>} />
          </Routes>
        </React.StrictMode>,
        { route: '/auth/callback?code=double-run-code' }
      );

      expect(await screen.findByText('Explore View')).toBeInTheDocument();
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('double-run-code');
    });
  });

  describe('ExplorePage First-time Google User Role Prompt', () => {
    it('shows role prompt card for clean CUSTOMER and allows switching to OWNER', async () => {
      const mockSession = {
        access_token: 'fake-jwt',
        user: { id: 'usr-3', email: 'guest@example.com' },
      };
      const mockProfile = {
        id: 'usr-3',
        role: 'CUSTOMER',
        is_active: true,
      };

      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      api.get.mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve(mockProfile);
        if (url === '/api/catalog/filters') return Promise.resolve({ cities: ['Goa'], spaceTypes: ['STUDIO'] });
        if (url.startsWith('/api/spaces')) return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 12, totalPages: 1 });
        return Promise.resolve({});
      });
      api.post.mockResolvedValue({ ...mockProfile, role: 'OWNER' });

      renderWithProviders(
        <Routes>
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/owner/dashboard" element={<div>Switched to Owner Dashboard</div>} />
        </Routes>,
        { route: '/explore' }
      );

      const promptCard = await screen.findByTestId('role-prompt-card');
      expect(promptCard).toBeInTheDocument();
      expect(screen.getByText('How will you use Nexora?')).toBeInTheDocument();

      // Click "Property Steward" to change role
      const stewardChoice = screen.getByRole('button', { name: /property steward/i });
      fireEvent.click(stewardChoice);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/auth/me/role', { role: 'OWNER' });
        expect(localStorage.getItem('nexora:role_prompt_dismissed')).toBe('true');
      });

      expect(await screen.findByText('Switched to Owner Dashboard')).toBeInTheDocument();
    });

    it('dismisses role prompt card and saves preference to localStorage', async () => {
      const mockSession = {
        access_token: 'fake-jwt',
        user: { id: 'usr-3', email: 'guest@example.com' },
      };
      const mockProfile = {
        id: 'usr-3',
        role: 'CUSTOMER',
        is_active: true,
      };

      supabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      api.get.mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve(mockProfile);
        if (url === '/api/catalog/filters') return Promise.resolve({ cities: ['Goa'], spaceTypes: ['STUDIO'] });
        if (url.startsWith('/api/spaces')) return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 12, totalPages: 1 });
        return Promise.resolve({});
      });

      renderWithProviders(
        <Routes>
          <Route path="/explore" element={<ExplorePage />} />
        </Routes>,
        { route: '/explore' }
      );

      const promptCard = await screen.findByTestId('role-prompt-card');
      expect(promptCard).toBeInTheDocument();

      const dismissBtn = screen.getByLabelText('Dismiss role prompt');
      fireEvent.click(dismissBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('role-prompt-card')).not.toBeInTheDocument();
        expect(localStorage.getItem('nexora:role_prompt_dismissed')).toBe('true');
      });
    });
  });
});
