import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconButton } from './IconButton';

/**
 * Animated Drawer (slide-over panel from right or bottom).
 * Usage:
 *   <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Filters">
 *     <FilterContent />
 *   </Drawer>
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
  size = 'md',
  className = '',
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const slideVariants = {
    right: {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
    },
    bottom: {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
    },
  };

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/50"
            aria-hidden="true"
          />

          <div
            className={cn(
              'fixed inset-y-0 right-0 flex max-w-full pl-10',
              position === 'bottom' && 'inset-x-0 bottom-0 top-auto pl-0'
            )}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              variants={slideVariants[position]}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className={cn(
                'w-screen bg-card border-l border-border/80 shadow-warm-xl flex flex-col',
                sizeClasses[size] || sizeClasses.md,
                position === 'bottom' && 'w-full max-h-[85vh] rounded-t-3xl border-t border-l-0',
                className
              )}
            >
              <div className="flex items-center justify-between p-5 border-b border-border/60">
                <h3 className="text-lg font-semibold text-ink">{title}</h3>
                <IconButton
                  icon={<X className="w-5 h-5" />}
                  label="Close drawer"
                  onClick={onClose}
                  size="sm"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-6">{children}</div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
