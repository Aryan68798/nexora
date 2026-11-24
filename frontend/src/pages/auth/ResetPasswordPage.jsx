import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, AlertCircle, KeyRound, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../features/auth/useAuth';
import { resolvePostLoginPath } from '../../lib/postLoginRedirect';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { BrandWordmark } from '../../components/layout/PublicLayout';

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Calculates password strength score (0 to 4)
 */
function calculateStrength(pwd = '') {
  let score = 0;
  if (!pwd) return score;
  if (pwd.length >= 8) score += 1;
  if (pwd.length >= 12) score += 1;
  if (/[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = [
  'bg-border',
  'bg-danger',
  'bg-warning',
  'bg-amber',
  'bg-success',
];

/**
 * ResetPasswordPage: Accepts new password with strength meter and rules,
 * updates via Supabase auth, and redirects to role home.
 * Shows a clear message with a request link if recovery link is invalid or expired.
 */
export function ResetPasswordPage() {
  const { session, profile, updatePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [expiredError, setExpiredError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(false);
  const exchangeAttemptedRef = useRef(false);

  // Check whether we have a valid recovery session or an explicit error in the URL
  useEffect(() => {
    let active = true;

    async function evaluateRecoverySession() {
      const searchParams = new URLSearchParams(location.search);
      const hashParams = new URLSearchParams(
        location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
      );

      const urlError = searchParams.get('error') || hashParams.get('error');
      const urlErrorDesc =
        searchParams.get('error_description') ||
        hashParams.get('error_description') ||
        '';

      if (urlError) {
        if (!active) return;
        setExpiredError(
          urlErrorDesc
            ? decodeURIComponent(urlErrorDesc.replace(/\+/g, ' '))
            : 'This recovery link is invalid or has expired.'
        );
        setCheckingRecovery(false);
        return;
      }

      // Check if session is already present via AuthContext or Supabase
      if (session) {
        if (!active) return;
        setHasValidSession(true);
        setCheckingRecovery(false);
        return;
      }

      // If code in query, exchange it once
      const code = searchParams.get('code');
      if (code && !exchangeAttemptedRef.current) {
        exchangeAttemptedRef.current = true;
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!active) return;
          if (error) {
            setExpiredError('This recovery link is invalid or has expired.');
            setCheckingRecovery(false);
            return;
          }
          if (data?.session) {
            setHasValidSession(true);
            setCheckingRecovery(false);
            return;
          }
        } catch {
          if (!active) return;
          setExpiredError('This recovery link is invalid or has expired.');
          setCheckingRecovery(false);
          return;
        }
      }

      // Fallback: query Supabase session directly
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!active) return;
        if (currentSession) {
          setHasValidSession(true);
          setCheckingRecovery(false);
        } else {
          // If no recovery session exists and no code present, link is not active
          setExpiredError('No active recovery session found. Please request a new link.');
          setCheckingRecovery(false);
        }
      } catch {
        if (!active) return;
        setExpiredError('Unable to verify recovery link. Please request a new one.');
        setCheckingRecovery(false);
      }
    }

    evaluateRecoverySession();

    return () => {
      active = false;
    };
  }, [location, session]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const passwordValue = watch('password') || '';
  const confirmPasswordValue = watch('confirmPassword') || '';

  const passwordRules = useMemo(
    () => ({
      minLength: passwordValue.length >= 8,
      hasLetter: /[a-zA-Z]/.test(passwordValue),
      hasNumber: /[0-9]/.test(passwordValue),
      matches: Boolean(passwordValue && passwordValue === confirmPasswordValue),
    }),
    [passwordValue, confirmPasswordValue]
  );

  const strengthScore = useMemo(() => calculateStrength(passwordValue), [passwordValue]);

  const onSubmit = async (values) => {
    setSubmitError(null);
    try {
      await updatePassword(values.password);
      setSuccess(true);
      setTimeout(() => {
        const dest = resolvePostLoginPath(profile);
        navigate(dest, { replace: true });
      }, 1500);
    } catch (err) {
      setSubmitError(err.message || 'Unable to update password. Please try again.');
    }
  };

  if (checkingRecovery) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <Spinner size="lg" label="Verifying recovery session..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6 text-ink">
      <div className="max-w-md w-full bg-card rounded-2xl p-8 sm:p-10 shadow-warm-md border border-border">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block focus-ring rounded-lg mb-6">
            <BrandWordmark />
          </Link>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink mb-2">
            Set New Password
          </h1>
          <p className="text-body text-sm leading-relaxed">
            Create a secure password to protect your account.
          </p>
        </div>

        {expiredError || !hasValidSession ? (
          <div className="text-center py-2" role="alert">
            <div className="w-14 h-14 rounded-full bg-danger/15 text-danger flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="font-serif font-bold text-lg text-ink mb-2">
              Recovery Link Expired
            </h2>
            <p className="text-body text-sm mb-6 leading-relaxed">
              {expiredError || 'This recovery link is invalid or has expired. Please request a new link to reset your password.'}
            </p>
            <div className="space-y-3">
              <Link to="/forgot-password" className="block">
                <Button variant="primary" size="lg" className="w-full justify-center">
                  Request New Link
                </Button>
              </Link>
              <Link to="/login" className="block">
                <Button variant="ghost" size="md" className="w-full justify-center" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        ) : success ? (
          <div className="text-center py-4" role="status" aria-live="polite">
            <div className="w-14 h-14 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="font-serif font-bold text-lg text-ink mb-2">
              Password Updated
            </h2>
            <p className="text-body text-sm leading-relaxed">
              Your password has been changed successfully. Redirecting you to your account...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {submitError && (
              <div
                className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-start justify-between gap-3"
                role="alert"
              >
                <div className="flex items-start gap-2.5 flex-1">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="leading-snug">{submitError}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  className="text-xs font-semibold underline hover:no-underline shrink-0 text-danger hover:text-ink transition-colors focus-ring rounded"
                >
                  Retry
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                New Password <span className="text-primary">*</span>
              </label>
              <PasswordInput
                placeholder="••••••••"
                autoComplete="new-password"
                hasError={Boolean(errors.password)}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-danger mt-1.5">{errors.password.message}</p>
              )}
            </div>

            {/* Password Strength Meter */}
            {passwordValue && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-body">Password strength:</span>
                  <span className="font-medium text-ink">
                    {STRENGTH_LABELS[strengthScore]}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 h-1.5">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-full rounded-full transition-all duration-300 ${
                        strengthScore >= level
                          ? STRENGTH_COLORS[strengthScore]
                          : 'bg-border'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Confirm New Password <span className="text-primary">*</span>
              </label>
              <PasswordInput
                placeholder="••••••••"
                autoComplete="new-password"
                hasError={Boolean(errors.confirmPassword)}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-danger mt-1.5">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Rules Checklist */}
            <div className="bg-sand/40 border border-border rounded-xl p-3.5 space-y-2 text-xs">
              <p className="font-semibold text-ink">Password must contain:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-body">
                <span className={`inline-flex items-center gap-1.5 ${passwordRules.minLength ? 'text-success font-medium' : ''}`}>
                  {passwordRules.minLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-body/50" />}
                  At least 8 characters
                </span>
                <span className={`inline-flex items-center gap-1.5 ${passwordRules.hasLetter ? 'text-success font-medium' : ''}`}>
                  {passwordRules.hasLetter ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-body/50" />}
                  At least one letter
                </span>
                <span className={`inline-flex items-center gap-1.5 ${passwordRules.hasNumber ? 'text-success font-medium' : ''}`}>
                  {passwordRules.hasNumber ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-body/50" />}
                  At least one number
                </span>
                <span className={`inline-flex items-center gap-1.5 ${passwordRules.matches && confirmPasswordValue ? 'text-success font-medium' : ''}`}>
                  {passwordRules.matches && confirmPasswordValue ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-body/50" />}
                  Passwords match
                </span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center shadow-warm-sm"
              loading={isSubmitting}
              leftIcon={<KeyRound className="w-4 h-4" />}
            >
              Update Password
            </Button>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center text-xs font-semibold text-primary-hover hover:underline focus-ring rounded"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Return to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
