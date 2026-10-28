import React, { useState } from 'react';
import { cn } from '../../lib/utils';

/**
 * Avatar with image loading and smooth initials fallback.
 * Usage:
 *   <Avatar name="Harish Mehta" src="https://..." size="md" />
 */
export function Avatar({
  name = '',
  src,
  size = 'md',
  className = '',
  status,
  ...props
}) {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base font-semibold',
    xl: 'w-20 h-20 text-xl font-semibold',
  };

  // Generate initials (max 2 characters)
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

  // Warm background tint based on initials char code for stable distinct color
  const charCode = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  const tints = [
    'bg-primary/15 text-primary-hover',
    'bg-amber/25 text-ink',
    'bg-sand text-ink border border-border',
    'bg-primary/20 text-ink',
  ];
  const tintClass = tints[charCode % tints.length];

  return (
    <div className={cn('relative inline-flex shrink-0 select-none', className)} {...props}>
      <div
        className={cn(
          'rounded-full overflow-hidden flex items-center justify-center font-medium shadow-warm-sm',
          sizeClasses[size] || sizeClasses.md,
          tintClass
        )}
      >
        {src && !hasError ? (
          <img
            src={src}
            alt={name || 'Avatar'}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-card',
            size === 'xs' || size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3',
            status === 'online' && 'bg-success',
            status === 'busy' && 'bg-danger',
            status === 'away' && 'bg-warning'
          )}
        />
      )}
    </div>
  );
}
