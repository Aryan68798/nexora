import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

/**
 * Accessible Icon-only button with minimum 44px touch target.
 * Usage:
 *   <IconButton icon={<Bell className="w-5 h-5" />} label="Notifications" onClick={handleClick} />
 */
export const IconButton = forwardRef(function IconButton(
  {
    icon,
    label,
    variant = 'ghost',
    size = 'md',
    isLoading = false,
    disabled = false,
    className = '',
    type = 'button',
    ...props
  },
  ref
) {
  const baseStyles =
    'relative inline-flex items-center justify-center rounded-xl transition-colors duration-150 focus-ring select-none active:scale-[0.95] disabled:opacity-50 disabled:pointer-events-none';

  const variantStyles = {
    primary: 'bg-primary text-white shadow-warm hover:bg-primary-hover active:bg-primary-hover',
    secondary: 'bg-sand text-ink hover:bg-border/60 active:bg-border border border-border shadow-warm-sm',
    ghost: 'bg-transparent text-body hover:text-ink hover:bg-sand active:bg-border/50',
    danger: 'bg-danger text-white shadow-warm hover:bg-danger/90 active:bg-danger/80',
  };

  const sizeStyles = {
    sm: 'w-9 h-9 min-w-[36px]',
    md: 'w-11 h-11 min-w-[44px]', // 44px touch target standard
    lg: 'w-13 h-13 min-w-[52px]',
  };

  const isInteractiveDisabled = disabled || isLoading;

  return (
    <motion.button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={isInteractiveDisabled}
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      whileTap={!isInteractiveDisabled ? { scale: 0.95 } : undefined}
      {...props}
    >
      {isLoading ? <Spinner size="sm" className="text-current" /> : icon}
    </motion.button>
  );
});
