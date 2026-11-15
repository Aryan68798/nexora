import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { snappySpring } from '../../lib/motion';
import { haptics } from '../../lib/haptics';
import { cn } from '../../lib/utils';

/**
 * Native Context Menu
 * Triggered by:
 * - Touch long-press (~450ms, with medium haptic feedback and touchmove cancel)
 * - Desktop right-click (contextmenu event)
 * - Click or keyboard enter/space on the visible "More" trigger button
 */
export function ContextMenu({
  items = [],
  children,
  className = '',
  buttonLabel = 'More options',
  buttonClassName = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const pressTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Open menu at coordinate or button position
  const openMenuAt = useCallback((x, y) => {
    haptics.medium();
    // Constrain to viewport bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 220;
    const menuHeight = items.length * 44 + 16;

    const safeX = Math.min(Math.max(16, x), viewportWidth - menuWidth - 16);
    const safeY = Math.min(Math.max(16, y), viewportHeight - menuHeight - 16);

    setPosition({ x: safeX, y: safeY });
    setIsOpen(true);
  }, [items.length]);

  // Touch long press handlers
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    pressTimerRef.current = setTimeout(() => {
      openMenuAt(touch.clientX, touch.clientY);
    }, 450);
  };

  const handleTouchMove = (e) => {
    if (!pressTimerRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    // Cancel if finger moved more than 10px
    if (dx > 10 || dy > 10) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  // Desktop right-click
  const handleContextMenu = (e) => {
    e.preventDefault();
    openMenuAt(e.clientX, e.clientY);
  };

  // Visible button click
  const handleButtonClick = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    openMenuAt(rect.left - 180, rect.bottom + 8);
  };

  // Close on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };

    const handleGlobalKey = (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('pointerdown', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKey);

    return () => {
      window.removeEventListener('pointerdown', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKey);
    };
  }, [isOpen, closeMenu]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      className={cn('relative', className)}
    >
      {children}

      {/* Visible Action Button for Discoverability & Keyboard Access */}
      <button
        type="button"
        aria-label={buttonLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={handleButtonClick}
        className={cn(
          'absolute top-3 right-3 z-10 w-8 h-8 rounded-xl border border-border bg-card/95 hover:bg-sand text-body hover:text-ink flex items-center justify-center transition-colors focus-ring shadow-warm-xs',
          buttonClassName
        )}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {/* Popover Menu */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label={buttonLabel}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={snappySpring}
              style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
              }}
              className="pointer-events-auto min-w-[200px] rounded-xl bg-card border border-border p-1.5 shadow-warm-lg z-50 flex flex-col gap-0.5 text-sm"
            >
              {items.map((item, idx) => {
                const IconComponent = item.icon;
                const isDestructive = item.destructive;

                return (
                  <button
                    key={idx}
                    role="menuitem"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeMenu();
                      haptics.light();
                      item.onClick?.();
                    }}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-left flex items-center gap-2.5 transition-colors focus-ring select-none text-xs font-medium',
                      isDestructive
                        ? 'text-danger hover:bg-danger/10'
                        : 'text-ink hover:bg-sand'
                    )}
                  >
                    {IconComponent && (
                      <span className={cn('w-4 h-4 shrink-0', isDestructive ? 'text-danger' : 'text-body')}>
                        {React.isValidElement(IconComponent) ? IconComponent : <IconComponent className="w-4 h-4" />}
                      </span>
                    )}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
