import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Textarea with terracotta focus ring and character counter support.
 * Usage:
 *   <Textarea rows={4} placeholder="Describe the maintenance issue..." {...register('description')} />
 */
export const Textarea = forwardRef(function Textarea(
  {
    className = '',
    rows = 4,
    hasError = false,
    disabled = false,
    ...props
  },
  ref
) {
  const isInvalid = props['aria-invalid'] || hasError;

  return (
    <textarea
      ref={ref}
      rows={rows}
      disabled={disabled}
      className={cn(
        'w-full px-3.5 py-2.5 text-base text-ink bg-card border rounded-xl placeholder:text-body/50 transition-all focus-ring disabled:bg-sand/40 disabled:text-body/60 disabled:cursor-not-allowed resize-y',
        isInvalid ? 'border-danger-500 focus-visible:ring-danger-500' : 'border-border hover:border-border/80',
        className
      )}
      {...props}
    />
  );
});
