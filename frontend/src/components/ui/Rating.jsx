import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Rating component: displays stars or allows interactive rating (1-5)
 * @param {Object} props
 * @param {number} [props.value] - Current rating value (1-5, or decimal for display)
 * @param {(rating: number) => void} [props.onChange] - Callback when star clicked
 * @param {number} [props.max] - Max stars (default 5)
 * @param {boolean} [props.readonly] - Read-only display mode
 * @param {string} [props.size] - 'sm' | 'md' | 'lg'
 * @param {string} [props.className] - Additional classes
 */
export function Rating({
  value = 0,
  onChange,
  max = 5,
  readonly = false,
  size = 'md',
  className = '',
}) {
  const [hoverValue, setHoverValue] = useState(0);

  const starSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleKeyDown = (e, starIndex) => {
    if (readonly || !onChange) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(starIndex);
    }
  };

  return (
    <div
      className={cn('inline-flex items-center gap-1 select-none', className)}
      role={readonly ? 'img' : 'radiogroup'}
      aria-label={readonly ? `Rating: ${value} out of ${max} stars` : 'Rate this service'}
    >
      {Array.from({ length: max }, (_, index) => {
        const starIndex = index + 1;
        const isFilled = (hoverValue || value) >= starIndex;
        const isHalf = !hoverValue && value >= starIndex - 0.5 && value < starIndex;

        if (readonly) {
          return (
            <span key={index} className="text-amber">
              <Star
                className={cn(
                  starSizes[size] || starSizes.md,
                  isFilled ? 'fill-amber text-amber' : isHalf ? 'fill-amber/40 text-amber' : 'text-border'
                )}
                aria-hidden="true"
              />
            </span>
          );
        }

        return (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={value === starIndex}
            aria-label={`${starIndex} star${starIndex > 1 ? 's' : ''}`}
            onClick={() => onChange && onChange(starIndex)}
            onMouseEnter={() => setHoverValue(starIndex)}
            onMouseLeave={() => setHoverValue(0)}
            onKeyDown={(e) => handleKeyDown(e, starIndex)}
            className="p-1 rounded focus-ring transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              className={cn(
                starSizes[size] || starSizes.md,
                isFilled ? 'fill-amber text-amber' : 'text-border hover:text-amber'
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
