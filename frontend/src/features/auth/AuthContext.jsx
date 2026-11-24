import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { api, ApiError } from '../../api/client';
import { mapAuthError, AuthError } from './authErrors';

const AuthContext = createContext(null);

export { AuthError, mapAuthError };

/**
 * Robust, production-grade AuthProvider component for Nexora.
 * Authority: Role and identity always come from PostgreSQL profiles table via GET /api/auth/me.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  // Status state machine: "loading" | "signedOut" | "signedIn" | "error"
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const inFlightProfileRef = useRef(null);
  const mountedRef = useRef(true);

  // Safely obtain queryClient if available in provider tree
  let queryClient = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    queryClient = useQueryClient();
  } catch {
    // QueryClient optional in isolated test harnesses
  }

  /**
   * Fetch authenticated user's profile from /api/auth/me.
   * - Explicit token passing (eliminates storage race conditions)
   * - Request deduplication via inFlightProfileRef
   * - Up to 3 retries with short delays for fresh database trigger creations
   * - Never swallows errors: throws typed AuthError
   */
  const fetchProfile = useCallback(async (sessionOrToken = null, retryCount = 0) => {
    // Deduplicate concurrent requests
    if (inFlightProfileRef.current && retryCount === 0) {
      return inFlightProfileRef.current;
    }

    const token = typeof sessionOrToken === 'string'
      ? sessionOrToken
      : sessionOrToken?.access_token || null;

    const promise = (async () => {
      try {
        const data = await api.get('/api/auth/me', {
          token: token || undefined,
          skipUnauthorizedEvent: true,
        });

        if (mountedRef.current) {
          setProfile(data);
          setError(null);
          setStatus('signedIn');
        }
        return data;
      } catch (err) {
        if (err instanceof ApiError) {
          // Disabled account handled explicitly
          if (err.code === 'ACCOUNT_DISABLED') {
            const disabledProfile = { is_active: false, disabled: true };
            if (mountedRef.current) {
              setProfile(disabledProfile);
              setError(new AuthError('ACCOUNT_DISABLED', 'Account is disabled. Please contact support.', 'none', err));
              setStatus('error');
            }
            throw err;
          }

          // Retry on 404 (fresh signup trigger race) up to 3 times
          if (err.status === 404 && retryCount < 3) {
            await new Promise((res) => setTimeout(res, 600 * (retryCount + 1)));
            return fetchProfile(sessionOrToken, retryCount + 1);
          }

          if (err.status === 401) {
            if (mountedRef.current) {
              setProfile(null);
              setStatus('signedOut');
            }
            throw err;
          }
        }

        const mapped = mapAuthError(err);
        if (mountedRef.current) {
          setError(mapped);
          setStatus('error');
        }
        throw mapped;
      } finally {
        inFlightProfileRef.current = null;
      }
    })();

    inFlightProfileRef.current = promise;
    return promise;
  }, []);

  /**
   * Sign out current user:
   * - Calls supabase.auth.signOut
   * - Clears React Query cache
   * - Clears local draft items
   * - Resets auth state
   * - Navigates to "/"
   */
  const signOut = useCallback(async () => {
    setStatus('loading');
    try {
      await supabase.auth.signOut().catch(() => {});
    } finally {
      // Clear react-query cache
      if (queryClient && typeof queryClient.clear === 'function') {
        queryClient.clear();
      }

      // Clear local storage drafts and temporary items
      if (typeof localStorage !== 'undefined') {
        try {
          Object.keys(localStorage).forEach((key) => {
            if (key.includes('draft') || key.startsWith('nexora:')) {
              localStorage.removeItem(key);
            }
          });
        } catch {
          // ignore storage access issues
        }
      }

      if (typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.removeItem('nexora:pending_role');
          sessionStorage.removeItem('nexora:auth_return_to');
        } catch {
          // ignore
        }
      }

      if (mountedRef.current) {
        setSession(null);
        setProfile(null);
        setError(null);
        setStatus('signedOut');
      }

      // Safe redirect to root
      if (typeof window !== 'undefined' && window.location?.pathname !== '/') {
        try {
          window.location.assign('/');
        } catch {
          // fallback
        }
      }
    }
  }, [queryClient]);

  /**
   * Manual retry to load profile with current active session
   */
  const retryProfile = useCallback(async () => {
    if (!session) {
      throw new AuthError('NO_SESSION', 'No active session found to retry profile.', 'signin');
    }
    setStatus('loading');
    setError(null);
    try {
      const p = await fetchProfile(session);
      return p;
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped);
      setStatus('error');
      throw mapped;
    }
  }, [session, fetchProfile]);

  /**
   * Initialize and subscribe once to Supabase Auth state changes
   */
  useEffect(() => {
    mountedRef.current = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession }, error: sessionErr } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        if (sessionErr) throw sessionErr;

        if (initialSession) {
          setSession(initialSession);
          try {
            await fetchProfile(initialSession);
          } catch {
            // Error already surfaced inside fetchProfile
          }
        } else {
          setSession(null);
          setProfile(null);
          setStatus('signedOut');
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(mapAuthError(err));
          setStatus('error');
        }
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mountedRef.current) return;

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setSession(currentSession);
          if (currentSession) {
            try {
              await fetchProfile(currentSession);
            } catch {
              // surfaced in fetchProfile
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
          setError(null);
          setStatus('signedOut');
        } else if (event === 'PASSWORD_RECOVERY') {
          setSession(currentSession);
          if (currentSession) {
            setStatus('signedIn');
          }
        }
      }
    );

    // Global listener for 401 unauthorized
    const handleUnauthorized = () => {
      if (mountedRef.current) {
        signOut();
      }
    };
    window.addEventListener('nexora:unauthorized', handleUnauthorized);

    return () => {
      mountedRef.current = false;
      subscription?.unsubscribe();
      window.removeEventListener('nexora:unauthorized', handleUnauthorized);
    };
  }, [fetchProfile, signOut]);

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async ({ email, password }) => {
    setStatus('loading');
    setError(null);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authErr) throw authErr;

      setSession(data.session);
      const userProfile = await fetchProfile(data.session);
      if (!userProfile) {
        throw new AuthError('PROFILE_ERROR', 'Unable to retrieve user profile.', 'retry_profile');
      }

      setStatus('signedIn');
      return { user: data.user, session: data.session, profile: userProfile };
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped);
      setStatus('error');
      throw mapped;
    }
  }, [fetchProfile]);

  /**
   * Sign up a new user with metadata:
   * options.data: { name, role }
   * Role is strictly clamped: CUSTOMER, OWNER or PROVIDER only (never ADMIN).
   */
  const signUp = useCallback(async ({ name, fullName, email, password, role = 'CUSTOMER' }) => {
    setStatus('loading');
    setError(null);
    try {
      const effectiveName = (name || fullName || '').trim();
      const normalizedRole = typeof role === 'string' ? role.trim().toUpperCase() : 'CUSTOMER';
      const safeRole = (normalizedRole === 'OWNER' || normalizedRole === 'PROVIDER')
        ? normalizedRole
        : 'CUSTOMER';

      const { data, error: authErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: effectiveName,
            full_name: effectiveName,
            role: safeRole,
          },
        },
      });

      if (authErr) throw authErr;

      if (data?.session) {
        setSession(data.session);
        const userProfile = await fetchProfile(data.session);
        setStatus('signedIn');
        return { user: data.user, session: data.session, profile: userProfile };
      }

      // No session returned: confirmation email was dispatched by Supabase
      setStatus('signedOut');
      return { user: data?.user || null, session: null, profile: null };
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped);
      setStatus('error');
      throw mapped;
    }
  }, [fetchProfile]);

  /**
   * Password reset: request recovery email
   */
  const sendPasswordReset = useCallback(async (email) => {
    setError(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (resetErr) throw resetErr;
      return true;
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped);
      throw mapped;
    }
  }, []);

  /**
   * Password reset: set new password using active recovery session
   */
  const updatePassword = useCallback(async (newPassword) => {
    setError(null);
    try {
      const { data, error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) throw updateErr;

      if (data?.session) {
        setSession(data.session);
        await fetchProfile(data.session);
      }
      return data;
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped);
      throw mapped;
    }
  }, [fetchProfile]);

  /**
   * Resend signup confirmation email
   */
  const resendConfirmationEmail = useCallback(async (email) => {
    setError(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });
      if (resendErr) throw resendErr;
      return true;
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped);
      throw mapped;
    }
  }, []);

  /**
   * Sign in with Google OAuth via Supabase (preserved)
   */
  const signInWithGoogle = useCallback(async (options = {}) => {
    setError(null);
    try {
      if (options.role) {
        sessionStorage.setItem('nexora:pending_role', options.role);
      }
      if (options.returnTo) {
        sessionStorage.setItem('nexora:auth_return_to', options.returnTo);
      }
      const { data, error: authErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (authErr) throw authErr;
      return data;
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped);
      throw mapped;
    }
  }, []);

  /**
   * Role change for clean customer account via backend authority
   */
  const changeRole = useCallback(async (newRole) => {
    const updated = await api.post('/api/auth/me/role', { role: newRole });
    setProfile(updated);
    return updated;
  }, []);

  /**
   * Update profile fields (name, phone)
   */
  const updateProfile = useCallback(async (updates) => {
    const updated = await api.patch('/api/auth/me', updates);
    setProfile(updated);
    return updated;
  }, []);

  /**
   * Upload and update user avatar
   */
  const uploadAvatar = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const result = await api.upload('/api/auth/me/avatar', formData);
    await fetchProfile(session);
    return result;
  }, [fetchProfile, session]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      status, // "loading" | "signedOut" | "signedIn" | "error"
      role: profile?.role || null,
      isActive: profile?.is_active ?? true,
      isDisabled: profile?.is_active === false || profile?.disabled === true,
      loading: status === 'loading',
      error,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      retryProfile,
      resendConfirmationEmail,
      signInWithGoogle,
      changeRole,
      refreshProfile: fetchProfile,
      updateProfile,
      uploadAvatar,
      isAuthenticated: Boolean(status === 'signedIn' && session && profile && profile.is_active !== false),
    }),
    [
      session,
      profile,
      status,
      error,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      retryProfile,
      resendConfirmationEmail,
      signInWithGoogle,
      changeRole,
      fetchProfile,
      updateProfile,
      uploadAvatar,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
