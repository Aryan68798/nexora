import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * Card component with warm border, layered shadow, and optional hover lift.
 * Usage:
 *   <Card hover padding="lg">
 *     <h3>Card Title</h3>
 *   </Card>
 */
export function Card({
  children,
  className = '',
  hover = false,
  padding = 'md',
  onClick,
  as = 'div',
  ...props
}) {
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const Component = hover ? motion.div : as;
  const hoverProps = hover
    ? {
        whileHover: { y: -3 },
        transition: { type: 'spring', damping: 25, stiffness: 300 },
      }
    : {};

  return (
    <Component
      onClick={onClick}
      className={cn(
        'bg-card rounded-2xl border border-border/80 shadow-warm relative overflow-hidden',
        hover && 'cursor-pointer hover:shadow-warm-md hover:border-border transition-shadow duration-200',
        paddingStyles[padding],
        className
      )}
      {...hoverProps}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={cn('flex flex-col gap-1.5 pb-4 border-b border-border/40', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3 className={cn('text-xl font-semibold text-ink', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={cn('pt-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={cn('pt-4 mt-4 border-t border-border/40 flex items-center justify-between', className)} {...props}>
      {children}
    </div>
  );
}
