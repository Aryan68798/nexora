import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './Input';

/**
 * PasswordInput with integrated show/hide password toggle button.
 * Usage:
 *   <PasswordInput placeholder="Enter password" {...register('password')} />
 */
export const PasswordInput = forwardRef(function PasswordInput(
  { className = '', ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Input
      ref={ref}
      type={showPassword ? 'text' : 'password'}
      className={className}
      rightIcon={
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="p-1 -mr-1 text-body/70 hover:text-ink focus:outline-none focus-ring rounded-lg"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      }
      {...props}
    />
  );
});
