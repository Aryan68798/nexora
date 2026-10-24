import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * Accessible Toggle Switch with animated spring thumb.
 * Usage:
 *   <Switch checked={isEnabled} onChange={setIsEnabled} label="Email Notifications" />
 */
export function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  description,
  id,
  className = '',
}) {
  const generatedId = React.useId();
  const switchId = id || generatedId;

  return (
    <div className={cn('inline-flex items-center justify-between gap-3', className)}>
      {(label || description) && (
        <label htmlFor={switchId} className="flex flex-col text-sm cursor-pointer select-none">
          {label && <span className="font-medium text-ink">{label}</span>}
          {description && <span className="text-body text-xs">{description}</span>}
        </label>
      )}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange && onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-xl border-2 border-transparent transition-colors duration-200 ease-in-out focus-ring',
          checked ? 'bg-primary' : 'bg-sand',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className="sr-only">{label || 'Toggle'}</span>
        <motion.span
          layout
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-[8px] bg-card shadow-warm transform transition ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}
