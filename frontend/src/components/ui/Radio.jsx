import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Custom Radio button and RadioGroup.
 * Usage:
 *   <Radio name="plan" value="monthly" label="Monthly Billing" checked={plan === 'monthly'} onChange={handleChange} />
 */
export const Radio = forwardRef(function Radio(
  {
    id,
    name,
    value,
    label,
    description,
    className = '',
    checked,
    disabled = false,
    onChange,
    ...props
  },
  ref
) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'relative inline-flex items-start gap-3 cursor-pointer select-none',
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
    >
      <div className="relative flex items-center justify-center shrink-0 mt-0.5">
        <input
          ref={ref}
          id={inputId}
          name={name}
          type="radio"
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="peer sr-only"
          {...props}
        />
        <div
          className={cn(
            'w-5 h-5 rounded-full border transition-all duration-150 flex items-center justify-center',
            'border-border bg-card peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-cream',
            'peer-checked:border-primary',
            'hover:border-primary'
          )}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-primary opacity-0 peer-checked:opacity-100 transition-opacity" />
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col text-sm">
          {label && <span className="font-medium text-ink">{label}</span>}
          {description && <span className="text-body text-xs mt-0.5">{description}</span>}
        </div>
      )}
    </label>
  );
});

export function RadioGroup({ label, error, children, className = '' }) {
  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      {label && <legend className="text-sm font-medium text-ink mb-1">{label}</legend>}
      <div className="flex flex-col gap-2.5">{children}</div>
      {error && <p className="text-xs font-medium text-danger mt-1">{error}</p>}
    </fieldset>
  );
}
