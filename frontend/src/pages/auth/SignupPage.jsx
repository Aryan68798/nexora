import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Compass, Building, Wrench, Check } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { getRoleDashboardPath } from '../../routes/guards';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { FormField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { Stepper } from '../../components/ui/Stepper';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import { BrandWordmark } from '../../components/layout/PublicLayout';
import { cn } from '../../lib/utils';

// Password strength evaluator
function calculatePasswordStrength(pass) {
  if (!pass) return { score: 0, label: 'Empty', color: 'bg-sand' };
  let score = 0;
  if (pass.length >= 8) score += 1;
  if (/[A-Z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-danger' };
  if (score === 2) return { score: 2, label: 'Fair', color: 'bg-warning' };
  if (score === 3) return { score: 3, label: 'Good', color: 'bg-success' };
  return { score: 4, label: 'Strong', color: 'bg-success' };
}

const signupSchema = z
  .object({
    role: z.enum(['CUSTOMER', 'OWNER', 'PROVIDER'], {
      required_error: 'Please choose an account type',
    }),
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    phone: z
      .string()
      .regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid Indian phone number (e.g. +919876543210)')
      .optional()
      .or(z.literal('')),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    agreeTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must agree to the terms to proceed' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Editorial Signup page with Role Selection Stepper & Password Strength
 */
export function SignupPage() {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role')?.toLowerCase();
  const initialRole = roleParam === 'owner' ? 'OWNER' : roleParam === 'provider' ? 'PROVIDER' : 'CUSTOMER';

  const [step, setStep] = useState(0); // 0: Select Role, 1: Account Details
  const [authError, setAuthError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSignUp = async (roleToUse) => {
    setAuthError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle({ role: roleToUse || selectedRole });
    } catch (err) {
      setAuthError(err.message || 'Failed to initialize Google sign-in');
      setGoogleLoading(false);
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: initialRole,
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false,
    },
  });

  const selectedRole = watch('role');
  const watchedPassword = watch('password', '');
  const passStrength = calculatePasswordStrength(watchedPassword);

  const roles = [
    {
      id: 'CUSTOMER',
      title: 'Customer',
      tagline: 'Book workspaces & meeting rooms',
      description: 'Reserve verified professional spaces by the day or month across India.',
      icon: Compass,
    },
    {
      id: 'OWNER',
      title: 'Property Steward',
      tagline: 'List properties & track revenue',
      description: 'List properties, oversee bookings and manage expenses with precision.',
      icon: Building,
    },
    {
      id: 'PROVIDER',
      title: 'Service Provider',
      tagline: 'Accept maintenance jobs',
      description: 'Handle certified electrical, plumbing, carpentry, and cleaning assignments.',
      icon: Wrench,
    },
  ];

  const handleNextStep = async () => {
    const isRoleValid = await trigger('role');
    if (isRoleValid) {
      setStep(1);
    }
  };

  const onSubmit = async (values) => {
    setAuthError(null);
    try {
      const res = await signUp({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        phone: values.phone || null,
        role: values.role,
      });

      // If Supabase requires email confirmation, res.session might be null
      if (res?.user && !res?.session) {
        setSuccessInfo(true);
      } else if (res?.profile) {
        navigate(getRoleDashboardPath(res.profile.role), { replace: true });
      } else {
        navigate(getRoleDashboardPath(values.role), { replace: true });
      }
    } catch (err) {
      setAuthError(err.message || 'Unable to register account. Please check your credentials.');
    }
  };

  if (successInfo) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6 text-ink">
        <div className="max-w-md w-full bg-card rounded-2xl p-8 border border-border shadow-warm-sm text-center">
          <div className="w-12 h-12 rounded-full bg-success/10 text-success-700 flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">Check your email</h2>
          <p className="text-body text-sm leading-relaxed mb-6">
            We have sent a verification email to your address. Please click the link inside
            to activate your Nexora account.
          </p>
          <Link to="/login">
            <Button variant="primary" className="w-full justify-center active:scale-[0.98]">
              Go to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col md:flex-row text-ink">
      {/* Editorial Left Column */}
      <div className="md:w-5/12 lg:w-1/2 bg-sand border-b md:border-b-0 md:border-r border-border p-8 sm:p-12 lg:p-20 flex flex-col justify-between">
        <div>
          <Link to="/" className="inline-block focus-ring rounded-lg mb-12 sm:mb-16">
            <BrandWordmark />
          </Link>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-ink tracking-tight leading-tight mb-4">
            Create your Nexora account.
          </h1>

          <p className="text-body text-base sm:text-lg leading-relaxed max-w-md mb-8">
            Connect with verified workspace locations, manage properties, or deliver certified maintenance services.
          </p>

          <Stepper
            steps={[
              { title: 'Account Type', description: 'Choose your role' },
              { title: 'Credentials', description: 'Your personal info' },
            ]}
            currentStep={step}
            onStepClick={(idx) => setStep(idx)}
          />
        </div>

        <div className="pt-8 border-t border-border mt-12 hidden sm:block text-xs text-body">
          <p>Nexora complies with strict data privacy principles and zero third-party tracking.</p>
        </div>
      </div>

      {/* Main Registration Form Column */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-cream">
        <div className="max-w-lg w-full bg-card rounded-2xl p-8 sm:p-10 border border-border shadow-warm-sm">
          {step === 0 ? (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-2">
                  Choose your role
                </h2>
                <p className="text-body text-sm leading-relaxed">
                  Select how you plan to participate in the Nexora ecosystem.
                </p>
              </div>

              <div className="space-y-3 mb-8">
                {roles.map((r) => {
                  const Icon = r.icon;
                  const isSelected = selectedRole === r.id;

                  return (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={r.title}
                      onClick={() => setValue('role', r.id)}
                      className={cn(
                        'w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4 focus-ring active:scale-[0.99]',
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-warm-xs'
                          : 'border-border bg-card hover:bg-sand/40 hover:border-border/80'
                      )}
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                          isSelected
                            ? 'bg-primary text-cream'
                            : 'bg-sand text-ink'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-base font-semibold text-ink">
                            {r.title}
                          </h3>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-xs font-medium text-primary mb-1">
                          {r.tagline}
                        </p>
                        <p className="text-xs text-body leading-relaxed">
                          {r.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full justify-center shadow-warm-sm active:scale-[0.98]"
                onClick={handleNextStep}
                disabled={googleLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue with {roles.find((r) => r.id === selectedRole)?.title}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-body font-medium">Or</span>
                </div>
              </div>

              <GoogleSignInButton
                onClick={() => handleGoogleSignUp(selectedRole)}
                loading={googleLoading}
                className="w-full"
              />
            </div>
          ) : (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-1">
                    Your Details
                  </h2>
                  <p className="text-body text-sm">
                    Creating account as <span className="font-semibold text-primary">{selectedRole}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="text-xs font-medium text-primary hover:underline focus-ring rounded"
                >
                  Change role
                </button>
              </div>

              {authError && (
                <div
                  className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm mb-6"
                  role="alert"
                >
                  {authError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <FormField label="Full Name" error={errors.fullName?.message} required>
                  <Input
                    placeholder="Your legal name"
                    autoComplete="name"
                    hasError={Boolean(errors.fullName)}
                    {...register('fullName')}
                  />
                </FormField>

                <FormField label="Email Address" error={errors.email?.message} required>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    hasError={Boolean(errors.email)}
                    {...register('email')}
                  />
                </FormField>

                <FormField
                  label="Phone Number"
                  error={errors.phone?.message}
                  hint="Optional. Used for reservation and maintenance updates"
                >
                  <Input
                    type="tel"
                    placeholder="+919876543210"
                    autoComplete="tel"
                    hasError={Boolean(errors.phone)}
                    {...register('phone')}
                  />
                </FormField>

                <div>
                  <label className="text-sm font-medium text-ink block mb-1.5">
                    Password <span className="text-primary">*</span>
                  </label>
                  <PasswordInput
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    hasError={Boolean(errors.password)}
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-xs text-danger mt-1">{errors.password.message}</p>
                  )}

                  {/* Password Strength Meter */}
                  {watchedPassword && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-body font-medium">Strength:</span>
                        <span className="font-semibold text-ink">{passStrength.label}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 h-1.5">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={cn(
                              'h-full rounded-sm transition-all',
                              level <= passStrength.score
                                ? passStrength.color
                                : 'bg-sand'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <FormField
                  label="Confirm Password"
                  error={errors.confirmPassword?.message}
                  required
                >
                  <PasswordInput
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    hasError={Boolean(errors.confirmPassword)}
                    {...register('confirmPassword')}
                  />
                </FormField>

                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                      {...register('agreeTerms')}
                    />
                    <span className="text-xs text-body leading-relaxed">
                      I agree to the{' '}
                      <Link to="/terms" className="text-primary underline hover:text-primary-hover">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" className="text-primary underline hover:text-primary-hover">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                  {errors.agreeTerms && (
                    <p className="text-xs text-danger mt-1">{errors.agreeTerms.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full justify-center shadow-warm-sm mt-4 active:scale-[0.98]"
                  loading={isSubmitting}
                  disabled={googleLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create {selectedRole} Account
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-body font-medium">Or</span>
                </div>
              </div>

              <GoogleSignInButton
                onClick={() => handleGoogleSignUp(selectedRole)}
                loading={googleLoading}
                disabled={isSubmitting}
                className="w-full"
              />
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-sm text-body">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-primary hover:underline focus-ring rounded transition-colors"
              >
                Sign in instead
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
