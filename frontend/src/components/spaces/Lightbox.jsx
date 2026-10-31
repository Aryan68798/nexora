import React, { useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Fullscreen Accessible Lightbox
 * Features:
 * - Focus trap (keeps keyboard focus inside lightbox)
 * - Keyboard navigation (ArrowLeft, ArrowRight, Escape)
 * - Touch swipe navigation (mobile)
 * - Image preloading for adjacent photos
 * - Counter badge (e.g. 3 / 8) and interactive thumbnail strip
 */
export function Lightbox({
  images = [],
  currentIndex = 0,
  isOpen = false,
  onClose,
  onNavigate,
}) {
  const containerRef = useRef(null);
  const touchStartXRef = useRef(null);
  const touchEndXRef = useRef(null);

  const total = images.length;
  const currentImage = images[currentIndex];

  // Preload adjacent images
  useEffect(() => {
    if (!isOpen || total <= 1) return;
    const nextIdx = (currentIndex + 1) % total;
    const prevIdx = (currentIndex - 1 + total) % total;

    if (images[nextIdx]?.url) {
      const imgNext = new Image();
      imgNext.src = images[nextIdx].url;
    }
    if (images[prevIdx]?.url) {
      const imgPrev = new Image();
      imgPrev.src = images[prevIdx].url;
    }
  }, [isOpen, currentIndex, images, total]);

  // Handle navigation
  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    onNavigate((currentIndex - 1 + total) % total);
  }, [currentIndex, total, onNavigate]);

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    onNavigate((currentIndex + 1) % total);
  }, [currentIndex, total, onNavigate]);

  // Focus trap & keyboard listeners
  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement;
    // Set focus to lightbox container
    containerRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Tab') {
        // Focus trap
        if (!containerRef.current) return;
        const focusable = containerRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Prevent background scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousActiveElement?.focus?.();
    };
  }, [isOpen, onClose, handlePrev, handleNext]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchEndXRef.current = null;
  };

  const handleTouchMove = (e) => {
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartXRef.current || !touchEndXRef.current) return;
    const distance = touchStartXRef.current - touchEndXRef.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      handleNext(); // Swiped left -> next
    } else if (distance < -minSwipeDistance) {
      handlePrev(); // Swiped right -> prev
    }
  };

  if (!isOpen || !currentImage) return null;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery lightbox"
      className="fixed inset-0 z-50 bg-ink/95 flex flex-col justify-between select-none outline-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Bar: Counter & Close Button */}
      <div className="flex items-center justify-between p-4 sm:p-6 text-white z-10">
        <span className="text-xs sm:text-sm font-medium tracking-wider px-3 py-1 rounded-xl bg-white/10">
          {currentIndex + 1} / {total}
        </span>

        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring"
          aria-label="Close lightbox"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Image Stage */}
      <div className="flex-1 flex items-center justify-center relative px-4 sm:px-16 overflow-hidden">
        {total > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div className="max-w-5xl max-h-[75vh] flex flex-col items-center">
          <img
            src={currentImage.url}
            alt={currentImage.caption || `Space photo ${currentIndex + 1}`}
            className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-warm-lg"
          />
          {currentImage.caption && (
            <p className="text-white/80 text-xs sm:text-sm mt-3 text-center max-w-lg">
              {currentImage.caption}
            </p>
          )}
        </div>

        {total > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {total > 1 && (
        <div className="p-4 sm:p-6 overflow-x-auto flex items-center justify-center gap-2 z-10">
          {images.map((img, idx) => (
            <button
              key={img.id || idx}
              type="button"
              onClick={() => onNavigate(idx)}
              className={cn(
                'w-14 h-10 sm:w-16 sm:h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 focus-ring',
                idx === currentIndex
                  ? 'border-primary ring-2 ring-primary/40 scale-105'
                  : 'border-transparent opacity-50 hover:opacity-100'
              )}
              aria-label={`View photo ${idx + 1}`}
              aria-current={idx === currentIndex ? 'true' : 'false'}
            >
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
