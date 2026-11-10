import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

/**
 * EmptyState component for zero-data states with custom inline SVG illustration
 * @param {Object} props
 * @param {React.ReactNode} [props.icon] - Optional custom Lucide icon or illustration
 * @param {string} props.title - Title headline
 * @param {string} [props.description] - Descriptive help text
 * @param {string} [props.actionLabel] - CTA button text
 * @param {() => void} [props.onAction] - CTA button click handler
 * @param {string} [props.actionVariant] - Button variant
 * @param {React.ReactNode} [props.children] - Additional slot
 * @param {string} [props.className] - Additional classes
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = 'primary',
  children,
  className = '',
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 md:p-12',
        'rounded-2xl border border-dashed border-border bg-sand/40',
        className
      )}
      role="region"
      aria-label={title}
    >
      <div className="mb-4 flex items-center justify-center">
        {React.isValidElement(icon) ? (
          icon
        ) : typeof icon === 'function' || (icon && typeof icon === 'object' && icon.$$typeof) ? (
          React.createElement(icon, { className: 'w-10 h-10 text-primary' })
        ) : (
          <div className="w-20 h-20 rounded-full bg-sand flex items-center justify-center text-body border border-border">
            {/* Architectural outline SVG */}
            <svg
              className="w-10 h-10 text-primary"
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 42V16L24 6l18 10v26H6z" />
              <path d="M18 42V28h12v14" />
              <path d="M24 16v4" />
              <circle cx="24" cy="22" r="0.5" fill="currentColor" />
              <path d="M32 20h4v6h-4z" />
              <path d="M12 20h4v6h-4z" />
            </svg>
          </div>
        )}
      </div>

      <h3 className="font-serif text-xl md:text-2xl font-bold text-ink mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-body text-sm md:text-base max-w-md mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {children}

      {actionLabel && onAction && (
        <Button
          variant={actionVariant}
          onClick={onAction}
          className="mt-2"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
