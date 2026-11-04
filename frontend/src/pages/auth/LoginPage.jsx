import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { resolvePostLoginPath } from '../../lib/postLoginRedirect';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { FormField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { BrandWordmark } from '../../components/layout/PublicLayout';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * Modern editorial split-screen Login page
 * Free of AI badges, pills, and filler clichés.
 */
export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState(null);

  const roleParam = new URLSearchParams(location.search).get('role')?.toLowerCase();
  const roleLabelMap = {
    customer: 'customer',
    owner: 'property owner',
    provider: 'service provider',
  };
  const roleHint = roleLabelMap[roleParam] || null;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error_description') || params.get('error');
    if (errorParam) {
      setAuthError(decodeURIComponent(errorParam.replace(/\+/g, ' ')));
    }
  }, [location]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values) => {
    setAuthError(null);
    try {
      const { profile } = await signIn(values);
      const dest = resolvePostLoginPath(profile, location.state?.from);
      navigate(dest, { replace: true });
    } catch (err) {
      setAuthError(err.message || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col md:flex-row text-ink">
      {/* Editorial Left Brand Column */}
      <div className="md:w-5/12 lg:w-1/2 bg-sand border-b md:border-b-0 md:border-r border-border p-8 sm:p-12 lg:p-20 flex flex-col justify-between">
        <div>
          <Link to="/" className="inline-block focus-ring rounded-lg mb-12 sm:mb-16">
            <BrandWordmark />
          </Link>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-ink tracking-tight leading-tight mb-4">
            Sign in to your account.
          </h1>

          <p className="text-body text-base sm:text-lg leading-relaxed max-w-md">
            Manage your bookings, listed properties, and maintenance requests in one place.
          </p>
        </div>

        {/* Factual Information - No AI Badge */}
        <div className="pt-8 border-t border-border mt-12 hidden sm:block">
          <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-2">
            Workspace & Property Management
          </p>
          <p className="text-body text-sm leading-relaxed max-w-sm">
            Nexora connects customers with verified meeting spaces across India, giving owners precision ledger management and providers direct service jobs.
          </p>
        </div>
      </div>

      {/* Main Login Form Column */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-cream">
        <div className="max-w-md w-full bg-card rounded-2xl p-8 sm:p-10 border border-border shadow-warm-sm">
          <div className="mb-8">
            {roleHint && (
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                Signing in as {roleHint}
              </p>
            )}
            <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-2">
              Sign In
            </h2>
            <p className="text-body text-sm leading-relaxed">
              Enter your credentials to access your account.
            </p>
          </div>

          {authError && (
            <div
              className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm mb-6 flex items-start justify-between gap-3"
              role="alert"
            >
              <div className="flex items-start gap-2.5 flex-1">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="leading-snug">{authError}</span>
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

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <FormField label="Email Address" error={errors.email?.message} required>
              <Input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                hasError={Boolean(errors.email)}
                {...register('email')}
              />
            </FormField>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-ink">
                  Password <span className="text-primary">*</span>
                </label>
                <Link
                  to="/reset-password"
                  className="text-xs font-medium text-primary-hover hover:underline transition-colors focus-ring rounded"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                placeholder="••••••••"
                autoComplete="current-password"
                hasError={Boolean(errors.password)}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-danger mt-1.5">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center shadow-warm-sm active:scale-[0.98] transition-transform"
              loading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-sm text-body">
              Don&apos;t have an account yet?{' '}
              <Link
                to={roleParam ? `/signup?role=${roleParam}` : '/signup'}
                className="font-medium text-primary-hover hover:underline focus-ring rounded transition-colors"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
