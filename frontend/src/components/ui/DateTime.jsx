import React from 'react';
import { formatKolkata } from '../../lib/utils';
import { cn } from '../../lib/utils';

/**
 * DateTime display component formatted specifically for Asia/Kolkata
 * @param {Object} props
 * @param {string|Date} props.value - Date string or Date object
 * @param {string} [props.formatStr] - Format string (default: 'dd MMM yyyy, h:mm a')
 * @param {boolean} [props.relative] - Display relative time (e.g. 2 hours ago)
 * @param {string} [props.className] - Additional classes
 */
export function DateTime({
  value,
  formatStr = 'dd MMM yyyy, h:mm a',
  className = '',
}) {
  if (!value) return null;

  const formatted = formatKolkata(value, formatStr);
  const isoStr = typeof value === 'string' ? value : value?.toISOString?.() || '';

  return (
    <time dateTime={isoStr} className={cn('text-body', className)}>
      {formatted}
    </time>
  );
}
