import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { mapAuthError } from '../features/auth/authErrors';
import { resolvePostLoginPath } from '../lib/postLoginRedirect';
import { LoginPage } from '../pages/auth/LoginPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { supabase } from '../lib/supabase';
import { api } from '../api/client';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      resend: vi.fn(),
    },
  },
}));

// Mock API Client
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

function StatusInspector() {
  const { status, session, profile, error } = useAuth();
  return (
    <div data-testid="status-inspector">
      <span data-testid="auth-status">{status}</span>
      <span data-testid="user-id">{session?.user?.id || 'none'}</span>
      <span data-testid="profile-role">{profile?.role || 'none'}</span>
      <span data-testid="auth-error">{error?.message || 'none'}</span>
    </div>
  );
}

describe('Auth Flow Rebuild Unit & Integration Tests', () => {
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

  // 1. AuthContext State Machine
  describe('1. AuthContext State Machine', () => {
    it('transitions from loading to signedOut when no initial session exists', async () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <StatusInspector />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('signedOut');
      });
      expect(screen.getByTestId('user-id')).toHaveTextContent('none');
    });

    it('transitions from loading to signedIn when valid initial session and profile exist', async () => {
      const mockSession = {
        access_token: 'valid-jwt',
        user: { id: 'usr-1', email: 'owner@example.com' },
      };
      const mockProfile = {
        id: 'usr-1',
        name: 'Verified Owner',
        role: 'OWNER',
        is_active: true,
      };

      supabase.auth.getSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      api.get.mockImplementation(async (url) => {
        if (url === '/api/auth/me') return mockProfile;
        return null;
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <StatusInspector />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('signedIn');
        expect(screen.getByTestId('user-id')).toHaveTextContent('usr-1');
        expect(screen.getByTestId('profile-role')).toHaveTextContent('OWNER');
      });
    });
  });

  // 2. signUp sending options.data with role and name & ADMIN protection
  describe('2. signUp options.data and role sanitization', () => {
    function SignUpCaller({ onReady }) {
      const { signUp } = useAuth();
      React.useEffect(() => {
        onReady(signUp);
      }, [signUp, onReady]);
      return <div>SignUp Caller</div>;
    }

    it('sends name and role in options.data when signing up', async () => {
      let signUpFn;
      render(
        <MemoryRouter>
          <AuthProvider>
            <SignUpCaller onReady={(fn) => { signUpFn = fn; }} />
          </AuthProvider>
        </MemoryRouter>
      );

      supabase.auth.signUp.mockResolvedValueOnce({
        data: {
          user: { id: 'usr-new' },
          session: null,
        },
        error: null,
      });

      await act(async () => {
        await signUpFn({
          name: 'Rohan Owner',
          email: 'rohan@example.com',
          password: 'Password123!',
          role: 'OWNER',
        });
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'rohan@example.com',
        password: 'Password123!',
        options: {
          data: {
            name: 'Rohan Owner',
            full_name: 'Rohan Owner',
            role: 'OWNER',
          },
        },
      });
    });

    it('clamps role ADMIN to CUSTOMER before sending options.data', async () => {
      let signUpFn;
      render(
        <MemoryRouter>
          <AuthProvider>
            <SignUpCaller onReady={(fn) => { signUpFn = fn; }} />
          </AuthProvider>
        </MemoryRouter>
      );

      supabase.auth.signUp.mockResolvedValueOnce({
        data: {
          user: { id: 'usr-admin-attempt' },
          session: null,
        },
        error: null,
      });

      await act(async () => {
        await signUpFn({
          name: 'Attacker',
          email: 'attacker@example.com',
          password: 'Password123!',
          role: 'ADMIN',
        });
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'attacker@example.com',
        password: 'Password123!',
        options: {
          data: {
            name: 'Attacker',
            full_name: 'Attacker',
            role: 'CUSTOMER', // CLAMPED
          },
        },
      });
    });

    it('handles session returned vs no-session returned (email confirmation path)', async () => {
      let signUpFn;
      render(
        <MemoryRouter>
          <AuthProvider>
            <SignUpCaller onReady={(fn) => { signUpFn = fn; }} />
          </AuthProvider>
        </MemoryRouter>
      );

      // (a) No session path
      supabase.auth.signUp.mockResolvedValueOnce({
        data: {
          user: { id: 'usr-unconfirmed' },
          session: null,
        },
        error: null,
      });

      let resNoSession;
      await act(async () => {
        resNoSession = await signUpFn({
          name: 'Unconfirmed',
          email: 'unconfirmed@example.com',
          password: 'Password123!',
          role: 'CUSTOMER',
        });
      });
      expect(resNoSession.session).toBeNull();
      expect(resNoSession.profile).toBeNull();

      // (b) Session returned path
      const mockSession = { access_token: 'token-abc', user: { id: 'usr-confirmed' } };
      const mockProfile = { id: 'usr-confirmed', role: 'CUSTOMER', is_active: true };
      supabase.auth.signUp.mockResolvedValueOnce({
        data: {
          user: { id: 'usr-confirmed' },
          session: mockSession,
        },
        error: null,
      });
      api.get.mockResolvedValueOnce(mockProfile);

      let resSession;
      await act(async () => {
        resSession = await signUpFn({
          name: 'Confirmed',
          email: 'confirmed@example.com',
          password: 'Password123!',
          role: 'CUSTOMER',
        });
      });
      expect(resSession.session).toBe(mockSession);
      expect(resSession.profile).toEqual(mockProfile);
    });
  });

  // 3. Friendly Error Mapping
  describe('3. Friendly Error Mapping (mapAuthError)', () => {
    it('maps already registered messages', () => {
      const err = mapAuthError(new Error('User already registered'));
      expect(err.type).toBe('ALREADY_REGISTERED');
      expect(err.message).toBe('An account with this email address already exists.');
    });

    it('maps invalid login credentials', () => {
      const err = mapAuthError(new Error('Invalid login credentials'));
      expect(err.type).toBe('INVALID_CREDENTIALS');
      expect(err.message).toContain('Invalid email or password');
    });

    it('maps unconfirmed email with resend action', () => {
      const err = mapAuthError(new Error('Email not confirmed'));
      expect(err.type).toBe('EMAIL_NOT_CONFIRMED');
      expect(err.action).toBe('resend');
    });

    it('maps weak password', () => {
      const err = mapAuthError(new Error('Password is too weak'));
      expect(err.type).toBe('WEAK_PASSWORD');
      expect(err.message).toContain('at least 8 characters');
    });

    it('maps rate limit errors', () => {
      const err = mapAuthError(new Error('over_email_send_rate_limit: 429'));
      expect(err.type).toBe('RATE_LIMIT');
      expect(err.message).toContain('Too many attempts');
    });

    it('maps signups disabled error', () => {
      const err = mapAuthError(new Error('Signups not allowed for this instance'));
      expect(err.type).toBe('SIGNUPS_DISABLED');
      expect(err.message).toContain('Account registration is currently closed');
    });

    it('maps network errors', () => {
      const err = mapAuthError(new Error('Failed to fetch'));
      expect(err.type).toBe('NETWORK_ERROR');
      expect(err.message).toContain('Network connection problem');
    });

    it('maps database error saving new user', () => {
      const err = mapAuthError(new Error('Database error saving new user'));
      expect(err.type).toBe('DATABASE_ERROR');
      expect(err.message).toBe('We could not save your account. Please try again in a minute.');
    });

    it('maps unknown errors with generic message and console details', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = mapAuthError(new Error('Something unexpected occurred in worker 9'));
      expect(err.type).toBe('UNKNOWN');
      expect(err.message).toBe('Unable to complete your request. Please try again later.');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // 4. Login Page Validation, Submit, and Error Display
  describe('4. LoginPage validation and error display', () => {
    it('validates empty inputs and invalid formats', async () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
        target: { value: 'notanemail' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('displays error and offers retry when credentials fail', async () => {
      supabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new Error('Invalid login credentials'),
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'WrongPassword123!' },
      });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });
  });

  // 5. Password Reset Neutral Confirmation
  describe('5. ForgotPasswordPage Neutral Confirmation', () => {
    it('always displays neutral confirmation without revealing account existence', async () => {
      supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/forgot-password']}>
          <AuthProvider>
            <ForgotPasswordPage />
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
        target: { value: 'anyone@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/instructions dispatched/i)).toBeInTheDocument();
        expect(screen.getByText(/if an account matches/i)).toBeInTheDocument();
      });
    });
  });

  // 6. resolvePostLoginPath Role Destinations & Safety Checks
  describe('6. resolvePostLoginPath validation', () => {
    const owner = { role: 'OWNER' };
    const provider = { role: 'PROVIDER' };
    const customer = { role: 'CUSTOMER' };
    const admin = { role: 'ADMIN' };

    it('routes each role to its default home dashboard', () => {
      expect(resolvePostLoginPath(owner)).toBe('/owner/dashboard');
      expect(resolvePostLoginPath(provider)).toBe('/provider/jobs');
      expect(resolvePostLoginPath(customer)).toBe('/explore');
      expect(resolvePostLoginPath(admin)).toBe('/admin');
    });

    it('rejects external or protocol-relative redirect URLs', () => {
      expect(resolvePostLoginPath(owner, 'https://evil.com')).toBe('/owner/dashboard');
      expect(resolvePostLoginPath(customer, '//evil.com')).toBe('/explore');
      expect(resolvePostLoginPath(provider, 'javascript:alert(1)')).toBe('/provider/jobs');
    });

    it('disallows returning to auth routes or root', () => {
      expect(resolvePostLoginPath(owner, '/login')).toBe('/owner/dashboard');
      expect(resolvePostLoginPath(owner, '/signup')).toBe('/owner/dashboard');
      expect(resolvePostLoginPath(customer, '/forgot-password')).toBe('/explore');
      expect(resolvePostLoginPath(customer, '/reset-password')).toBe('/explore');
      expect(resolvePostLoginPath(customer, '/')).toBe('/explore');
    });

    it('enforces role authorization on returnTo routes', () => {
      // Customer cannot be redirected to owner route
      expect(resolvePostLoginPath(customer, '/owner/properties')).toBe('/explore');
      // Owner cannot be redirected to provider route
      expect(resolvePostLoginPath(owner, '/provider/jobs')).toBe('/owner/dashboard');
      // Owner can be redirected to authorized owner route
      expect(resolvePostLoginPath(owner, '/owner/properties')).toBe('/owner/properties');
    });
  });
});
