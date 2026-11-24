import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { BrandWordmark } from '../../components/layout/PublicLayout';

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
});

/**
 * ForgotPasswordPage: Request password reset link.
 * Always renders a neutral confirmation to prevent email enumeration.
 */
export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await sendPasswordReset(values.email);
    } catch (err) {
      // In case of network errors or server downtime, capture message
      // Note: for user-not-found, Supabase returns 200 or generic ok when email enumeration protection is on
      if (err?.type === 'NETWORK_ERROR' || err?.status >= 500) {
        setFormError(err.message || 'Unable to connect to service. Please check your connection and retry.');
        return;
      }
    }
    // Always show neutral confirmation
    setSubmittedEmail(values.email.trim());
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6 text-ink">
      <div className="max-w-md w-full bg-card rounded-2xl p-8 sm:p-10 shadow-warm-md border border-border">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block focus-ring rounded-lg mb-6">
            <BrandWordmark />
          </Link>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink mb-2">
            Reset Password
          </h1>
          <p className="text-body text-sm leading-relaxed">
            Enter your account email to receive a password reset link.
          </p>
        </div>

        {submitted ? (
          <div className="text-center py-2" role="status" aria-live="polite">
            <div className="w-14 h-14 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="font-serif font-bold text-lg text-ink mb-2">
              Instructions Dispatched
            </h2>
            <p className="text-body text-sm mb-4 leading-relaxed">
              If an account matches <span className="font-medium text-ink">{submittedEmail}</span>, a password reset link has been dispatched. Please inspect your inbox.
            </p>
            <p className="text-body/80 text-xs mb-6 leading-relaxed">
              If the email does not arrive shortly, check your spam or junk folder.
            </p>
            <div className="space-y-3">
              <Button
                variant="secondary"
                size="md"
                className="w-full justify-center"
                onClick={() => setSubmitted(false)}
              >
                Send to another email
              </Button>
              <Link to="/login" className="block">
                <Button variant="ghost" size="md" className="w-full justify-center" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {formError && (
              <div
                className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-start justify-between gap-3"
                role="alert"
              >
                <div className="flex items-start gap-2.5 flex-1">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="leading-snug">{formError}</span>
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

            <FormField label="Email Address" error={errors.email?.message} required>
              <Input
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                autoComplete="email"
                hasError={Boolean(errors.email)}
                {...register('email')}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center shadow-warm-sm"
              loading={isSubmitting}
              leftIcon={<Mail className="w-4 h-4" />}
            >
              Send Reset Link
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
