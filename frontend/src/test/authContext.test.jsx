import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { supabase } from '../lib/supabase';
import { api } from '../api/client';

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

function ConsumerComponent() {
  const { user, profile, loading, signOut, isAuthenticated } = useAuth();

  if (loading) return <div>Auth Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div>
      <div data-testid="user-email">{user?.email}</div>
      <div data-testid="user-role">{profile?.role}</div>
      <button type="button" onClick={signOut}>
        Sign Out Button
      </button>
    </div>
  );
}

describe('AuthProvider Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts without throwing ReferenceError: Cannot access signOut before initialization', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    expect(() => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <div>Test Child</div>
          </AuthProvider>
        </MemoryRouter>
      );
    }).not.toThrow();

    expect(await screen.findByText('Test Child')).toBeInTheDocument();
  });

  it('signs user out when nexora:unauthorized event is dispatched and redirects to /login', async () => {
    const mockSession = {
      access_token: 'valid-jwt-token',
      user: { id: 'usr-1', email: 'steward@nexora.com' },
    };

    const mockProfile = {
      id: 'usr-1',
      name: 'Rohan Joshi',
      email: 'steward@nexora.com',
      role: 'OWNER',
      is_active: true,
    };

    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: mockSession },
      error: null,
    });

    supabase.auth.signOut.mockResolvedValueOnce({ error: null });
    api.get.mockResolvedValueOnce(mockProfile);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/dashboard" element={<ConsumerComponent />} />
            <Route path="/login" element={<div>Login Page Screen</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    // Confirm authenticated view is loaded
    expect(await screen.findByTestId('user-email')).toHaveTextContent('steward@nexora.com');
    expect(screen.getByTestId('user-role')).toHaveTextContent('OWNER');

    // Dispatch nexora:unauthorized event
    await act(async () => {
      window.dispatchEvent(new CustomEvent('nexora:unauthorized'));
    });

    // Verify supabase.auth.signOut was called
    expect(supabase.auth.signOut).toHaveBeenCalled();

    // Verify user is redirected to /login
    await waitFor(() => {
      expect(screen.getByText('Login Page Screen')).toBeInTheDocument();
    });
  });
});
