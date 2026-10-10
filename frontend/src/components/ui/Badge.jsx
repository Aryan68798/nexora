import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Refined Label / Tag component with crisp border and subtle neutral/semantic styling.
 * Used for role tags, counts, and technical identifiers without generic AI bubble pills.
 */
export function Badge({
  children,
  variant = 'default',
  size = 'md',
  tag = false,
  className = '',
  icon,
  ...props
}) {
  const variantStyles = {
    default: 'text-ink bg-sand/80 border border-border',
    terracotta: 'text-primary bg-primary/10 border border-primary/20',
    primary: 'text-primary bg-primary/10 border border-primary/20',
    amber: 'text-ink bg-amber/15 border border-amber/30',
    success: 'text-success-700 bg-success/10 border border-success/25',
    warning: 'text-ink bg-warning/15 border border-warning/30',
    danger: 'text-danger bg-danger/10 border border-danger/25',
    neutral: 'text-body bg-card border border-border',
  };

  const sizeStyles = {
    xs: 'text-[11px] px-1.5 py-0.5 gap-1 font-medium',
    sm: 'text-xs px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-0.5 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1 gap-2 font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-sans select-none tracking-tight',
        tag ? 'rounded-r-md rounded-l-none' : 'rounded-md',
        variantStyles[variant] || variantStyles.default,
        sizeStyles[size] || sizeStyles.md,
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
