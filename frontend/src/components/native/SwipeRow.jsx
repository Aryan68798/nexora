import React, { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { softSpring } from '../../lib/motion';
import { haptics } from '../../lib/haptics';
import { cn } from '../../lib/utils';

/**
 * SwipeRow Component
 * Allows swiping left on a row to reveal and trigger an action.
 * Used on: Notifications (mark read) and Favorites (remove).
 */
export function SwipeRow({
  children,
  onAction,
  actionLabel = 'Action',
  actionIcon,
  actionVariant = 'danger', // 'danger' | 'primary'
  actionWidth = 84,
  className = '',
}) {
  const [swipedOpen, setSwipedOpen] = useState(false);
  const x = useMotionValue(0);

  // Background action button opacity based on drag distance
  const actionOpacity = useTransform(x, [-actionWidth, -20, 0], [1, 0.6, 0]);

  const handleDragEnd = (_, info) => {
    // If dragged left past threshold or high velocity
    if (info.offset.x < -actionWidth * 0.75 || info.velocity.x < -300) {
      setSwipedOpen(true);
      haptics.light();
    } else {
      setSwipedOpen(false);
    }
  };

  const handleActionClick = (e) => {
    e.stopPropagation();
    haptics.medium();
    onAction?.();
    setSwipedOpen(false);
  };

  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-card border border-border', className)}>
      {/* Revealed Action on Drag */}
      <motion.div
        style={{ opacity: actionOpacity, width: actionWidth }}
        className={cn(
          'absolute right-0 top-0 bottom-0 flex flex-col items-center justify-center gap-1 text-white font-medium text-xs cursor-pointer select-none z-0',
          actionVariant === 'danger' ? 'bg-danger' : 'bg-primary'
        )}
        onClick={handleActionClick}
      >
        {actionIcon && <span className="w-4 h-4">{actionIcon}</span>}
        <span>{actionLabel}</span>
      </motion.div>

      {/* Draggable Foreground Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -actionWidth, right: 0 }}
        dragElastic={{ left: 0.2, right: 0 }}
        onDragEnd={handleDragEnd}
        animate={{ x: swipedOpen ? -actionWidth : 0 }}
        transition={softSpring}
        style={{ x }}
        className="relative z-10 bg-card w-full"
      >
        {children}
      </motion.div>
    </div>
  );
}
