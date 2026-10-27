import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../features/auth/useAuth';
import { getRoleDashboardPath } from '../../routes/guards';
import { Button } from '../../components/ui/Button';
import { BrandWordmark } from '../../components/layout/PublicLayout';

/**
 * Supabase OAuth Callback Handler
 * Handles the redirect return from Google OAuth, awaits Supabase session,
 * loads verified profile (with retry handling), executes any pending role change,
 * and redirects to the saved destination or role dashboard.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshProfile, changeRole } = useAuth();

  const [status, setStatus] = useState('processing'); // 'processing' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);
  const [isLinkingError, setIsLinkingError] = useState(false);
  const exchangePromiseRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function handleCallback() {
      // (a) Reads error and error_description from the URL first and shows a friendly message
      const searchParams = new URLSearchParams(location.search);
      const hashParams = new URLSearchParams(
        location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
      );

      const error = searchParams.get('error') || hashParams.get('error');
      const errorDesc =
        searchParams.get('error_description') ||
        hashParams.get('error_description') ||
        '';

      if (error) {
        if (!active) return;
        setStatus('error');
        const descLower = errorDesc.toLowerCase();
        if (
          descLower.includes('already registered') ||
          descLower.includes('email exists') ||
          descLower.includes('identity') ||
          error === 'exchange_failed'
        ) {
          setIsLinkingError(true);
          setErrorMessage(
            'An account with this email address already exists. Please sign in using your original email and password.'
          );
        } else if (
          descLower.includes('unsupported provider') ||
          descLower.includes('provider is not enabled') ||
          error === 'validation_failed'
        ) {
          setErrorMessage(
            'Google Sign-In is not enabled yet in your Supabase project. In your Supabase Dashboard, go to Authentication -> Providers -> Google and enable it with your Client ID and Client Secret.'
          );
        } else if (error === 'access_denied') {
          setErrorMessage('Google sign-in was cancelled or access was denied.');
        } else {
          setErrorMessage(
            decodeURIComponent(errorDesc.replace(/\+/g, ' ')) ||
              'Unable to complete Google sign-in. Please try again.'
          );
        }
        return;
      }

      try {
        // (b) Checks getSession() and only if there is no session and a code exists,
        // exchanges it exactly once, guarded by a ref so it never runs twice
        let session = null;
        const { data: initialData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;
        session = initialData?.session;

        const code = searchParams.get('code');
        if (!session && code) {
          if (!exchangePromiseRef.current) {
            exchangePromiseRef.current = (async () => {
              if (typeof supabase.auth.exchangeCodeForSession === 'function') {
                return await supabase.auth.exchangeCodeForSession(code);
              }
              return { data: { session: null }, error: null };
            })();
          }

          try {
            const { data: exchangeData, error: exchangeErr } = await exchangePromiseRef.current;
            if (exchangeErr) {
              console.warn('exchangeCodeForSession notice:', exchangeErr);
            } else if (exchangeData?.session) {
              session = exchangeData.session;
            }
          } catch (e) {
            console.warn('exchangeCodeForSession notice:', e);
          }
        }

        // If session is still not immediately ready in storage, wait briefly for auth change
        if (!session) {
          session = await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 5000);
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
              (event, newSession) => {
                if (newSession) {
                  clearTimeout(timeout);
                  subscription?.unsubscribe();
                  resolve(newSession);
                }
              }
            );
          });
        }

        if (!session) {
          throw new Error('Authentication session could not be established. Please try signing in again.');
        }

        // (d) Removes the code from the URL with history.replaceState
        if (code && typeof window !== 'undefined' && window.history?.replaceState) {
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
          } catch {
            // Ignore in environments where window.location is mock or restricted
          }
        }

        // (c) Then loads /api/auth/me passing the session token
        let profile = await refreshProfile(session, 0);
        if (!profile) {
          await new Promise((r) => setTimeout(r, 800));
          profile = await refreshProfile(session, 1);
        }

        // Handle pending role from signup (if OWNER or PROVIDER was selected)
        const pendingRole = sessionStorage.getItem('nexora:pending_role');
        if (
          pendingRole &&
          ['OWNER', 'PROVIDER'].includes(pendingRole) &&
          profile?.role === 'CUSTOMER'
        ) {
          try {
            const updated = await changeRole(pendingRole);
            if (updated) {
              profile = updated;
            }
          } catch (roleErr) {
            console.warn('Pending role assignment notice:', roleErr);
          } finally {
            sessionStorage.removeItem('nexora:pending_role');
          }
        } else {
          sessionStorage.removeItem('nexora:pending_role');
        }

        // Navigate to return URL or role dashboard
        const returnTo = sessionStorage.getItem('nexora:auth_return_to');
        sessionStorage.removeItem('nexora:auth_return_to');

        if (!active) return;
        const destination = returnTo || (profile?.role === 'CUSTOMER' ? '/explore' : getRoleDashboardPath(profile?.role));
        navigate(destination, { replace: true });
      } catch (err) {
        if (!active) return;
        setStatus('error');
        setErrorMessage(err.message || 'Failed to authenticate your session with Google.');
      }
    }

    handleCallback();

    return () => {
      active = false;
    };
  }, [location, navigate, refreshProfile, changeRole]);

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 text-ink">
      <div className="max-w-md w-full bg-card rounded-3xl p-8 sm:p-10 shadow-warm-md border border-border text-center">
        <div className="flex justify-center mb-6">
          <BrandWordmark />
        </div>

        {status === 'processing' ? (
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto animate-spin">
              <RefreshCw className="w-7 h-7" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-ink">
              Completing secure sign-in
            </h2>
            <p className="text-body text-sm leading-relaxed max-w-xs mx-auto">
              Verifying your Google credentials and synchronizing your Nexora steward profile...
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="w-14 h-14 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-ink">
              {isLinkingError ? 'Account Already Exists' : 'Sign-In Failed'}
            </h2>
            <p className="text-body text-sm leading-relaxed text-body">
              {errorMessage}
            </p>

            <div className="pt-4 flex flex-col gap-3">
              <Link to="/login">
                <Button variant="primary" className="w-full justify-center" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Return to Sign In
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="ghost" className="w-full justify-center">
                  Create a new account
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
