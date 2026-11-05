import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * Warm Tooltip with subtle hover delay.
 * Usage:
 *   <Tooltip content="Quick actions available">
 *     <Button>Hover Me</Button>
 *   </Tooltip>
 */
export function Tooltip({ children, content, position = 'top', className = '' }) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);

  if (!content) return children;

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), 200);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 pointer-events-none px-2.5 py-1 text-xs font-medium text-white bg-ink rounded-lg shadow-warm-md whitespace-nowrap',
              positions[position] || positions.top,
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
