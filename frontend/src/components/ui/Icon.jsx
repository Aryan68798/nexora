import React from 'react';
import { cn } from '../../lib/utils';

const SIZE_MAP = {
  sm: 16,
  md: 20,
  lg: 24,
};

/**
 * Standardized Lucide Icon wrapper
 * Enforces:
 * - One stroke width (1.75)
 * - One size scale: sm (16), md (20), lg (24)
 */
export function Icon({
  icon: IconComponent,
  size = 'md',
  strokeWidth = 1.75,
  className = '',
  ...props
}) {
  if (!IconComponent) return null;

  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 20;

  if (React.isValidElement(IconComponent)) {
    return React.cloneElement(IconComponent, {
      size: pixelSize,
      strokeWidth,
      className: cn('shrink-0', IconComponent.props.className, className),
      ...props,
    });
  }

  return (
    <IconComponent
      size={pixelSize}
      strokeWidth={strokeWidth}
      className={cn('shrink-0', className)}
      {...props}
    />
  );
}
