import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Styled Select component with custom chevron and touch target.
 * Usage:
 *   <Select options={[{ value: 'CUSTOMER', label: 'Customer' }]} {...register('role')} />
 */
export const Select = forwardRef(function Select(
  {
    options = [],
    placeholder = 'Select an option',
    className = '',
    hasError = false,
    disabled = false,
    children,
    ...props
  },
  ref
) {
  const isInvalid = props['aria-invalid'] || hasError;

  return (
    <div className="relative flex items-center w-full">
      <select
        ref={ref}
        disabled={disabled}
        className={cn(
          'w-full min-h-[44px] px-3.5 py-2.5 pr-10 text-base text-ink bg-card border rounded-xl appearance-none transition-all focus-ring disabled:bg-sand/40 disabled:text-body/60 disabled:cursor-not-allowed cursor-pointer',
          isInvalid ? 'border-danger-500 focus-visible:ring-danger-500' : 'border-border hover:border-border/80',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="text-body/50">
            {placeholder}
          </option>
        )}
        {children ||
          options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
      </select>
      <span className="absolute right-3.5 text-body pointer-events-none shrink-0" aria-hidden="true">
        <ChevronDown className="w-4 h-4" />
      </span>
    </div>
  );
});
