import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * Accessible DropdownMenu with keyboard navigation and click-outside dismissal.
 * Usage:
 *   <DropdownMenu trigger={<Button>Options</Button>}>
 *     <DropdownMenuItem onClick={...}>Edit</DropdownMenuItem>
 *     <DropdownMenuItem danger onClick={...}>Delete</DropdownMenuItem>
 *   </DropdownMenu>
 */
export function DropdownMenu({ trigger, children, align = 'right', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const alignStyles = {
    left: 'left-0',
    right: 'right-0',
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <div onClick={() => setIsOpen((prev) => !prev)}>
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 mt-1.5 min-w-[200px] bg-card rounded-2xl border border-border/80 shadow-warm-lg p-1.5 focus:outline-none',
              alignStyles[align] || alignStyles.right,
              className
            )}
            onClick={() => setIsOpen(false)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownMenuItem({ children, icon, danger = false, disabled = false, onClick, className = '' }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-colors select-none text-left focus-ring',
        danger
          ? 'text-danger-600 hover:bg-danger-50'
          : 'text-ink hover:bg-sand/70',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      {icon && <span className="w-4 h-4 shrink-0 text-current">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div className="h-px bg-border/60 my-1" role="separator" />;
}
