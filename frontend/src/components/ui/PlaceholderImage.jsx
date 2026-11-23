import React from 'react';
import { Image } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Plain fallback surface when space photo is missing.
 * Rule 8 compliant: plain sand surface, small Lucide icon, and "No photo yet".
 */
export function PlaceholderImage({
  spaceType,
  title,
  className = '',
  aspectRatio = '16/10',
  ...props
}) {
  const label = title || (spaceType ? `${spaceType} - No photo yet` : 'No photo yet');

  return (
    <div
      className={cn(
        'w-full bg-sand flex flex-col items-center justify-center gap-2 text-body select-none border border-border/40',
        className
      )}
      style={{ aspectRatio }}
      role="img"
      aria-label={label}
      {...props}
    >
      <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-body">
        <Image className="w-4 h-4 stroke-[1.75]" />
      </div>
      <span className="text-xs font-medium text-body/80 tracking-wide">
        No photo yet
      </span>
    </div>
  );
}
