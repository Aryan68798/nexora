import React from 'react';
import { formatINR } from '../../lib/utils';
import { cn } from '../../lib/utils';

/**
 * Formats price in INR with the ₹ sign and Indian numbering grouping (e.g. ₹12,34,567.50).
 * Takes "X.XX" string directly from API without floating point conversions.
 * Usage:
 *   <Price amount="1180.00" size="lg" />
 */
export function Price({
  amount,
  size = 'md',
  showSymbol = true,
  className = '',
  suffix,
  period,
}) {
  const formatted = formatINR(amount, showSymbol);
  const displaySuffix = suffix || (period ? `/ ${period}` : null);

  const sizeClasses = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-semibold',
    lg: 'text-xl font-bold font-display',
    xl: 'text-2xl sm:text-3xl font-bold font-display tracking-tight text-ink',
  };

  return (
    <span className={cn('inline-flex items-baseline gap-0.5 text-ink', sizeClasses[size], className)}>
      <span>{formatted}</span>
      {displaySuffix && (
        <span className="text-xs text-body font-normal font-sans ml-1">
          {displaySuffix}
        </span>
      )}
    </span>
  );
}
