import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Text Input with terracotta focus ring, optional left/right icons, and error states.
 * Usage:
 *   <Input type="email" placeholder="you@domain.com" leftIcon={<Mail />} />
 */
export const Input = forwardRef(function Input(
  {
    className = '',
    type = 'text',
    leftIcon,
    rightIcon,
    hasError = false,
    disabled = false,
    ...props
  },
  ref
) {
  const isInvalid = props['aria-invalid'] || hasError;

  return (
    <div className="relative flex items-center w-full">
      {leftIcon && (
        <span className="absolute left-3.5 text-body pointer-events-none shrink-0" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'w-full min-h-[44px] px-3.5 py-2.5 text-base text-ink bg-card border rounded-xl placeholder:text-body/50 transition-all focus-ring disabled:bg-sand/40 disabled:text-body/60 disabled:cursor-not-allowed',
          leftIcon && 'pl-10',
          rightIcon && 'pr-10',
          isInvalid ? 'border-danger-500 focus-visible:ring-danger-500' : 'border-border hover:border-border/80',
          className
        )}
        {...props}
      />
      {rightIcon && (
        <span className="absolute right-3.5 text-body shrink-0">
          {rightIcon}
        </span>
      )}
    </div>
  );
});
