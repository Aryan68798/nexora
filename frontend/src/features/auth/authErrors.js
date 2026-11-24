/**
 * Custom typed error class for authentication operations.
 */
export class AuthError extends Error {
  constructor(type, message, action = 'retry', originalError = null) {
    super(message);
    this.name = 'AuthError';
    this.type = type;
    this.action = action; // 'retry' | 'signin' | 'resend' | 'retry_profile' | 'none'
    this.originalError = originalError;
  }
}

/**
 * Maps Supabase, backend API, and network errors into user-friendly typed AuthErrors.
 * Details are logged only to the console for security and debugging.
 *
 * @param {any} err - Raw error from Supabase or fetch
 * @returns {AuthError}
 */
export function mapAuthError(err) {
  if (!err) return null;
  if (err instanceof AuthError) return err;

  const raw = (
    err?.message ||
    err?.error_description ||
    err?.code ||
    String(err || '')
  ).toLowerCase();

  // 1. Already registered
  if (
    raw.includes('already registered') ||
    raw.includes('already exists') ||
    raw.includes('user already registered') ||
    raw.includes('identity_already_exists')
  ) {
    return new AuthError(
      'ALREADY_REGISTERED',
      'An account with this email address already exists.',
      'signin',
      err
    );
  }

  // 2. Invalid login credentials
  if (
    raw.includes('invalid login credentials') ||
    raw.includes('invalid credentials') ||
    raw.includes('invalid_grant') ||
    raw.includes('wrong password')
  ) {
    return new AuthError(
      'INVALID_CREDENTIALS',
      'Invalid email or password. Please check your credentials and try again.',
      'retry',
      err
    );
  }

  // 3. Email not confirmed
  if (
    raw.includes('email not confirmed') ||
    raw.includes('email_not_confirmed') ||
    raw.includes('not verified')
  ) {
    return new AuthError(
      'EMAIL_NOT_CONFIRMED',
      'Your email address has not been confirmed yet. Please check your inbox or resend the confirmation link.',
      'resend',
      err
    );
  }

  // 4. Weak or short password
  if (
    raw.includes('weak') ||
    raw.includes('at least 6') ||
    raw.includes('at least 8') ||
    raw.includes('password is too weak') ||
    raw.includes('should be at least')
  ) {
    return new AuthError(
      'WEAK_PASSWORD',
      'Password is too weak. Please use at least 8 characters with at least one letter and one number.',
      'retry',
      err
    );
  }

  // 5. Invalid email format
  if (
    raw.includes('invalid email') ||
    raw.includes('email address is invalid') ||
    raw.includes('valid email')
  ) {
    return new AuthError(
      'INVALID_EMAIL',
      'Please enter a valid email address.',
      'retry',
      err
    );
  }

  // 6. Rate limit exceeded
  if (
    raw.includes('rate limit') ||
    raw.includes('too many requests') ||
    raw.includes('over_email_send_rate_limit') ||
    raw.includes('429')
  ) {
    return new AuthError(
      'RATE_LIMIT',
      'Too many attempts. Please wait a few minutes before trying again.',
      'retry',
      err
    );
  }

  // 7. Signups disabled
  if (
    raw.includes('signups disabled') ||
    raw.includes('signup is disabled') ||
    raw.includes('signups not allowed') ||
    raw.includes('signup_disabled')
  ) {
    return new AuthError(
      'SIGNUPS_DISABLED',
      'Account registration is currently closed. Please contact support.',
      'none',
      err
    );
  }

  // 8. Network failure
  if (
    raw.includes('network failure') ||
    raw.includes('network error') ||
    raw.includes('failed to fetch') ||
    raw.includes('networkrequestfailed')
  ) {
    return new AuthError(
      'NETWORK_ERROR',
      'Network connection problem. Please check your internet connection and try again.',
      'retry',
      err
    );
  }

  // 9. Database error saving new user
  if (
    raw.includes('database error') ||
    raw.includes('database') ||
    raw.includes('saving new user')
  ) {
    return new AuthError(
      'DATABASE_ERROR',
      'We could not save your account. Please try again in a minute.',
      'retry',
      err
    );
  }

  // 10. Profile loading error
  if (
    raw.includes('profile') ||
    raw.includes('unable to retrieve') ||
    raw.includes('failed to retrieve')
  ) {
    return new AuthError(
      'PROFILE_ERROR',
      err?.message || 'Account created, but we could not load your profile. Please retry.',
      'retry_profile',
      err
    );
  }

  // 11. Unknown / fallback (generic message to user, raw logged to console only)
  console.error('[Nexora Auth] Unmapped error details:', err);
  return new AuthError(
    'UNKNOWN',
    'Unable to complete your request. Please try again later.',
    'retry',
    err
  );
}
