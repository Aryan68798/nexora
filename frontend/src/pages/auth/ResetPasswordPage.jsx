import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { BrandWordmark } from '../../components/layout/PublicLayout';

const resetSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});

/**
 * ResetPasswordPage: Request password reset link
 */
export function ResetPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [resetError, setResetError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (values) => {
    setResetError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      setResetError(err.message || 'Unable to send reset instructions');
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6 text-ink">
      <div className="max-w-md w-full bg-card rounded-3xl p-8 sm:p-10 shadow-warm-md border border-border">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-block focus-ring rounded-lg mb-6">
            <BrandWordmark />
          </Link>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink mb-2">
            Reset Password
          </h1>
          <p className="text-body text-sm">
            Enter your account email to receive a recovery link.
          </p>
        </div>

        {submitted ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="font-serif font-bold text-lg text-ink mb-2">
              Instructions Dispatched
            </h2>
            <p className="text-body text-sm mb-6 leading-relaxed">
              If an account matches that email, a password reset link has been dispatched.
              Please check your inbox.
            </p>
            <Link to="/login">
              <Button variant="secondary" className="w-full justify-center" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Back to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {resetError && (
              <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
                {resetError}
              </div>
            )}

            <FormField label="Email Address" error={errors.email?.message} required>
              <Input
                type="email"
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
              Send Recovery Link
            </Button>

            <div className="pt-4 text-center">
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
