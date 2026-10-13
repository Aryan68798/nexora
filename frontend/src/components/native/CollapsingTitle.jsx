import React from 'react';
import { motion } from 'framer-motion';
import { useCollapsingTitle } from '../../lib/scrollMotion';
import { cn } from '../../lib/utils';

/**
 * Large Collapsing Title for mobile top-level screens.
 * Uses scroll-linked opacity and scale from src/lib/scrollMotion.js.
 */
export function CollapsingTitle({
  title,
  subtitle,
  actions,
  className = '',
}) {
  const { titleOpacity, titleScale } = useCollapsingTitle(70);

  return (
    <div className={cn('relative pb-4 border-b border-border', className)}>
      <motion.div
        style={{
          opacity: titleOpacity,
          scale: titleScale,
          transformOrigin: 'left top',
        }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-ink tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-body text-sm sm:text-base mt-2 max-w-xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {actions}
          </div>
        )}
      </motion.div>
    </div>
  );
}
