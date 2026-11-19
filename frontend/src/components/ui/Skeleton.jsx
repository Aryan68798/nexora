import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Warm Skeleton loaders (no cold grey).
 * Variants: text, circle, card, avatar, tableRow
 * Usage:
 *   <Skeleton variant="card" className="h-48" />
 */
export function Skeleton({ variant = 'text', className = '', ...props }) {
  const base = 'skeleton-shimmer rounded-xl select-none';

  const variants = {
    text: 'h-4 w-full rounded-md',
    avatar: 'w-10 h-10 rounded-full shrink-0',
    card: 'h-40 w-full rounded-2xl',
    circle: 'rounded-full',
    tableRow: 'h-12 w-full rounded-xl',
  };

  return (
    <div
      className={cn(base, variants[variant] || variants.text, className)}
      aria-hidden="true"
      {...props}
    />
  );
}
