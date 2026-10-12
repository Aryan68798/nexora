import React, { forwardRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Custom terracotta Checkbox with animated check indicator.
 * Usage:
 *   <Checkbox id="terms" label="I agree to terms" checked={agreed} onChange={setAgreed} />
 */
export const Checkbox = forwardRef(function Checkbox(
  {
    id,
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
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="peer sr-only"
          {...props}
        />
        <div
          className={cn(
            'w-5 h-5 rounded-md border transition-all duration-150 flex items-center justify-center',
            'border-border bg-card peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-cream',
            'peer-checked:bg-primary peer-checked:border-primary peer-checked:text-white',
            'hover:border-primary'
          )}
        >
          <Check className="w-3.5 h-3.5 stroke-[3] opacity-0 peer-checked:opacity-100 transition-opacity" />
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
