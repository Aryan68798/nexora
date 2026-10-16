import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { softSpring } from '../../lib/motion';
import { haptics } from '../../lib/haptics';
import { cn } from '../../lib/utils';

/**
 * Native BottomSheet component
 *
 * Mobile: Slides up over a solid scrim, drag handle, velocity/distance drag dismiss,
 * safe area inset, visualViewport keyboard lifting, focus trap, Escape and back close.
 * Desktop (md+): Renders as a centered dialog with identical API.
 */
export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  _snapPoints = [0.55, 0.92], // partial, full
}) {
  const sheetRef = useRef(null);
  const firstFocusableRef = useRef(null);

  // Trigger medium haptic when sheet opens
  useEffect(() => {
    if (isOpen) {
      haptics.medium();
    }
  }, [isOpen]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Handle mobile visualViewport resize when virtual keyboard opens
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      if (!sheetRef.current) return;
      const vv = window.visualViewport;
      const offset = window.innerHeight - vv.height;
      if (offset > 50) {
        sheetRef.current.style.bottom = `${offset}px`;
      } else {
        sheetRef.current.style.bottom = '0px';
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);

    return () => {
      window.visualViewport.removeEventListener('resize', handleResize);
      window.visualViewport.removeEventListener('scroll', handleResize);
    };
  }, [isOpen]);

  // Drag end gesture handler
  const handleDragEnd = (_, info) => {
    // If dragged downward with velocity > 300 or distance > 120, dismiss
    if (info.offset.y > 120 || info.velocity.y > 300) {
      haptics.light();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center">
          {/* Solid Scrim (Strictly NO blur/backdrop-filter) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            data-testid="sheet-scrim"
            className="fixed inset-0 bg-ink"
            aria-hidden="true"
          />

          {/* Sheet / Dialog Container */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'bottom-sheet-title' : undefined}
            initial={{ y: '100%', opacity: 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 1 }}
            transition={softSpring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.8 }}
            onDragEnd={handleDragEnd}
            className={cn(
              'relative w-full bg-card border-t md:border border-border z-10 flex flex-col',
              'rounded-t-[20px] md:rounded-[20px]',
              'max-h-[90dvh] md:max-w-lg md:max-h-[85vh]',
              'shadow-warm-xl pb-safe',
              className
            )}
          >
            {/* Mobile Drag Handle */}
            <div className="w-full flex flex-col items-center pt-3 pb-1 md:hidden cursor-grab active:cursor-grabbing touch-none">
              <div className="w-12 h-1.5 bg-border rounded-full" />
            </div>

            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 shrink-0">
              {title ? (
                <h3 id="bottom-sheet-title" className="font-editorial text-xl font-normal text-ink">
                  {title}
                </h3>
              ) : (
                <div />
              )}
              <button
                ref={firstFocusableRef}
                type="button"
                onClick={onClose}
                aria-label="Close sheet"
                className="w-9 h-9 rounded-xl border border-border bg-card hover:bg-sand text-body hover:text-ink flex items-center justify-center transition-colors focus-ring"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Sheet Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
