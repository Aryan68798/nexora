import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Modern Status Indicator mapping domain statuses to crisp status dots
 * and clear typography (eliminates AI pill/candy badge syndrome).
 *
 * Usage:
 *   <StatusBadge status="CONFIRMED" type="booking" />
 */
export function StatusBadge({ status, type: _type = 'general', className = '', ...props }) {
  if (!status) return null;

  const normalized = String(status).toUpperCase();

  const statusConfig = {
    // Bookings
    PENDING: { label: 'Pending', dot: 'bg-amber', text: 'text-ink font-medium' },
    CONFIRMED: { label: 'Confirmed', dot: 'bg-primary', text: 'text-primary-hover font-semibold' },
    CHECKED_IN: { label: 'Checked In', dot: 'bg-primary', text: 'text-primary-hover font-semibold' },
    CHECKED_OUT: { label: 'Checked Out', dot: 'bg-body/50', text: 'text-body font-medium' },
    COMPLETED: { label: 'Completed', dot: 'bg-success', text: 'text-success-700 font-semibold' },
    CANCELLED: { label: 'Cancelled', dot: 'bg-danger', text: 'text-danger font-medium' },
    REJECTED: { label: 'Rejected', dot: 'bg-danger', text: 'text-danger font-medium' },

    // Payments
    PAID: { label: 'Paid', dot: 'bg-success', text: 'text-success-700 font-semibold' },
    REFUNDED: { label: 'Refunded', dot: 'bg-amber', text: 'text-ink font-medium' },
    FAILED: { label: 'Failed', dot: 'bg-danger', text: 'text-danger font-medium' },

    // Maintenance
    OPEN: { label: 'Open', dot: 'bg-amber', text: 'text-ink font-medium' },
    ASSIGNED: { label: 'Assigned', dot: 'bg-body/60', text: 'text-body font-medium' },
    IN_PROGRESS: { label: 'In Progress', dot: 'bg-primary', text: 'text-primary-hover font-semibold' },

    // Inspections
    SCHEDULED: { label: 'Scheduled', dot: 'bg-body/60', text: 'text-body font-medium' },

    // Properties / Spaces
    ACTIVE: { label: 'Active', dot: 'bg-success', text: 'text-success-700 font-semibold' },
    INACTIVE: { label: 'Inactive', dot: 'bg-body/40', text: 'text-body font-medium' },
    AVAILABLE: { label: 'Available', dot: 'bg-success', text: 'text-success-700 font-semibold' },
    MAINTENANCE: { label: 'Under Maintenance', dot: 'bg-amber', text: 'text-amber-800 font-medium' },

    // Verification
    VERIFIED: { label: 'Verified', dot: 'bg-success', text: 'text-success-700 font-semibold' },
    UNVERIFIED: { label: 'Unverified', dot: 'bg-amber', text: 'text-amber-800 font-medium' },
  };

  const formatFallbackLabel = (str) =>
    str
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

  const config = statusConfig[normalized] || {
    label: formatFallbackLabel(normalized),
    dot: 'bg-body/60',
    text: 'text-body font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs select-none tracking-tight',
        config.text,
        className
      )}
      {...props}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', config.dot)} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
