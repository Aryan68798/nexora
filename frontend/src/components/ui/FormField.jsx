import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Accessible form field wrapper connecting label, hint, and error with aria attributes.
 * Usage:
 *   <FormField label="Full Name" error={errors.name?.message} hint="As shown on government ID">
 *     {(fieldProps) => <Input {...fieldProps} {...register('name')} />}
 *   </FormField>
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  className = '',
  children,
}) {
  const generatedId = React.useId();
  const fieldId = id || generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      {label && (
        <label
          htmlFor={fieldId}
          className="text-sm font-medium text-ink flex items-center justify-between"
        >
          <span>
            {label}
            {required && <span className="text-primary ml-1" aria-hidden="true">*</span>}
          </span>
        </label>
      )}

      {typeof children === 'function'
        ? children({ id: fieldId, 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) })
        : React.isValidElement(children)
        ? React.cloneElement(children, {
            id: fieldId,
            'aria-describedby': describedBy,
            'aria-invalid': Boolean(error),
          })
        : children}

      {hint && !error && (
        <p id={hintId} className="text-xs text-body/80">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger flex items-center gap-1">
          {error}
        </p>
      )}
    </div>
  );
}
