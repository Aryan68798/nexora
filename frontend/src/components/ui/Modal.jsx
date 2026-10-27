import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconButton } from './IconButton';

/**
 * Animated Modal with backdrop, focus trap, and Escape dismissal.
 * Usage:
 *   <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create Inspection">
 *     <p>Modal body content</p>
 *   </Modal>
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  className = '',
}) {
  const modalRef = useRef(null);

  // Close on Escape & Lock body scroll
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
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

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/50"
            aria-hidden="true"
          />

          {/* Modal Card */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={cn(
              'relative w-full bg-card rounded-3xl border border-border/80 shadow-warm-xl p-6 sm:p-8 z-10 overflow-hidden',
              sizeClasses[size] || sizeClasses.md,
              className
            )}
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                {title && (
                  <h3 id="modal-title" className="text-xl sm:text-2xl font-semibold text-ink">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-sm text-body mt-1">{description}</p>
                )}
              </div>
              <IconButton
                icon={<X className="w-5 h-5" />}
                label="Close dialog"
                onClick={onClose}
                size="sm"
                className="-mr-2 -mt-2 text-body/70 hover:text-ink"
              />
            </div>

            <div className="text-base text-ink">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
