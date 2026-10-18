import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { api, ApiError } from '../../api/client';

const AuthContext = createContext(null);

/**
 * Authentication Provider component
 * Manages Supabase session, loads verified role profile from /api/auth/me,
 * and exposes sign-in, sign-up, sign-out and profile update actions.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const inFlightProfileRef = useRef(null);

  /**
   * Sign out current user - declared before useEffect that references it
   */
  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch authenticated user's profile from backend authority /api/auth/me.
   * Accepts explicit session or token to eliminate storage race conditions.
   * Deduplicates concurrent in-flight requests.
   * Never hides errors: throws on failure so caller can handle appropriately.
   */
  const fetchProfile = useCallback(async (sessionOrToken = null, retryCount = 0) => {
    // If a request is already in flight and this is not a retry, reuse it
    if (inFlightProfileRef.current && retryCount === 0) {
      return inFlightProfileRef.current;
    }

    const token = typeof sessionOrToken === 'string'
      ? sessionOrToken
      : sessionOrToken?.access_token || null;

    const promise = (async () => {
      try {
        setError(null);
        const data = await api.get('/api/auth/me', {
          token: token || undefined,
          skipUnauthorizedEvent: true,
        });
        setProfile(data);
        return data;
      } catch (err) {
        if (err instanceof ApiError) {
          // Account is disabled
          if (err.code === 'ACCOUNT_DISABLED') {
            setProfile({ is_active: false, disabled: true });
            setError(err);
            throw err;
          }

          // On fresh signup, backend profile webhook/trigger might have a slight race condition
          if (err.status === 404 && retryCount < 3) {
            await new Promise((res) => setTimeout(res, 800));
            return fetchProfile(sessionOrToken, retryCount + 1);
          }

          if (err.status === 401) {
            setProfile(null);
            setError(err);
            throw err;
          }
        }
        setError(err);
        throw err;
      } finally {
        inFlightProfileRef.current = null;
      }
    })();

    inFlightProfileRef.current = promise;
    return promise;
  }, []);

  // Initialize auth state and subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          try {
            await fetchProfile(initialSession);
          } catch (err) {
            if (mounted) setError(err);
          }
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        if (mounted) setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(currentSession);
          setUser(currentSession?.user || null);
          try {
            await fetchProfile(currentSession);
          } catch (err) {
            if (mounted) setError(err);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setError(null);
        }
      }
    );

    // Listen for 401 unauthorized custom event from apiClient
    const handleUnauthorized = () => {
      if (mounted) {
        signOut();
      }
    };
    window.addEventListener('nexora:unauthorized', handleUnauthorized);

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      window.removeEventListener('nexora:unauthorized', handleUnauthorized);
    };
  }, [fetchProfile, signOut]);

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async ({ email, password }) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authErr) throw authErr;

      setSession(data.session);
      setUser(data.user);
      const userProfile = await fetchProfile(data.session);
      if (!userProfile) {
        throw new Error('Unable to retrieve user profile');
      }
      return { user: data.user, profile: userProfile };
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  /**
   * Sign up a new user with metadata (full_name, role, phone)
   * The backend trigger or auth sync creates the verified profile with this role.
   */
  const signUp = useCallback(async ({ email, password, fullName, phone, role = 'CUSTOMER' }) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone || '',
            role: role.toUpperCase(),
          },
        },
      });

      if (authErr) throw authErr;

      // If Supabase returned an active session directly
      if (data?.session) {
        setSession(data.session);
        setUser(data.user);
        try {
          await fetchProfile(data.session);
        } catch (err) {
          setError(err);
        }
      }

      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  /**
   * Sign in with Google OAuth via Supabase
   * Saves any pending role or returnTo destination in sessionStorage
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
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (authErr) throw authErr;
      return data;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  /**
   * Request role change for clean customer account via backend authority
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
    // Refresh profile to reflect new avatar_url
    await fetchProfile(session);
    return result;
  }, [fetchProfile, session]);

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      role: profile?.role || null,
      isActive: profile?.is_active ?? true,
      isDisabled: profile?.is_active === false || profile?.disabled === true,
      loading,
      error,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      changeRole,
      refreshProfile: fetchProfile,
      updateProfile,
      uploadAvatar,
      isAuthenticated: Boolean(session && profile && profile.is_active !== false),
    }),
    [
      session,
      user,
      profile,
      loading,
      error,
      fetchProfile,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      changeRole,
      updateProfile,
      uploadAvatar,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to consume AuthContext
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
