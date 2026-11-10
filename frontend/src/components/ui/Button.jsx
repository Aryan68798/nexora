import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

/**
 * Button component with variants, loading state, and 44px touch target.
 * Usage:
 *   <Button variant="primary" size="md" isLoading={false} onClick={handleClick}>
 *     Save Changes
 *   </Button>
 */
export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    loading = false,
    disabled = false,
    className = '',
    type = 'button',
    leftIcon,
    rightIcon,
    ...props
  },
  ref
) {
  const isBusy = isLoading || loading;
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium rounded-xl transition-colors duration-150 focus-ring select-none active:scale-[0.98] disabled:opacity-55 disabled:pointer-events-none disabled:active:scale-100';

  const variantStyles = {
    primary:
      'bg-primary text-white shadow-warm hover:bg-primary-hover active:bg-primary-hover border border-transparent',
    secondary:
      'bg-sand text-ink hover:bg-border/60 active:bg-border border border-border shadow-warm-sm',
    ghost:
      'bg-transparent text-body hover:text-ink hover:bg-sand/60 active:bg-sand border border-transparent',
    danger:
      'bg-danger text-white shadow-warm hover:bg-danger/90 active:bg-danger/80 border border-transparent',
    outline:
      'bg-transparent text-primary-hover border border-primary hover:bg-primary/10 active:bg-primary/20',
  };

  const sizeStyles = {
    sm: 'text-sm px-3.5 py-1.5 min-h-[36px] gap-1.5',
    md: 'text-base px-5 py-2.5 min-h-[44px] gap-2', // Meets 44px touch target
    lg: 'text-lg px-6 py-3 min-h-[50px] gap-2.5 font-semibold',
  };

  const isInteractiveDisabled = disabled || isBusy;

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isInteractiveDisabled}
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      whileTap={!isInteractiveDisabled ? { scale: 0.98 } : undefined}
      {...props}
    >
      {isBusy && (
        <span className="absolute inset-0 flex items-center justify-center bg-inherit rounded-xl">
          <Spinner size={size === 'lg' ? 'md' : 'sm'} className="text-current" />
        </span>
      )}
      <span className={cn('inline-flex items-center gap-2', isBusy && 'invisible')}>
        {leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </span>
    </motion.button>
  );
});
