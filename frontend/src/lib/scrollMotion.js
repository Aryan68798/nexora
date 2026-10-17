/**
 * Nexora Scroll Motion Library
 *
 * All scroll-linked behavior in the application is strictly centralized here.
 * Limited to:
 * 1. Collapsing title on top-level screens (Explore, My bookings, Favorites, Notifications)
 * 2. Header shadow appearance after scrolling
 * 3. Space detail gallery subtle pull-down scaling
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValue } from 'framer-motion';
import { useMotionPreference } from './motion';

/**
 * Hook for header shadow state after scrolling past a threshold
 */
export function useHeaderScrollShadow(threshold = 12) {
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setHasScrolled(window.scrollY > threshold);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return hasScrolled;
}

/**
 * Hook for large title collapsing on mobile screens into a compact bar.
 * Returns { titleOpacity, titleScale, compactTitleOpacity, scrollY }
 */
export function useCollapsingTitle(scrollThreshold = 60) {
  const { isReducedMotion } = useMotionPreference();
  const { scrollY } = useScroll();

  const staticOne = useMotionValue(1);
  const staticZero = useMotionValue(0);

  const titleOpacity = useTransform(scrollY, [0, scrollThreshold], [1, 0]);
  const titleScale = useTransform(scrollY, [0, scrollThreshold], [1, 0.95]);
  const compactTitleOpacity = useTransform(scrollY, [scrollThreshold * 0.7, scrollThreshold], [0, 1]);

  if (isReducedMotion) {
    return {
      titleOpacity: staticOne,
      titleScale: staticOne,
      compactTitleOpacity: staticZero,
      scrollY,
    };
  }

  return {
    titleOpacity,
    titleScale,
    compactTitleOpacity,
    scrollY,
  };
}

/**
 * Hook for space detail hero image subtle scale when pulling down
 */
export function useGalleryPullScale() {
  const { isReducedMotion } = useMotionPreference();
  const { scrollY } = useScroll();
  const staticOne = useMotionValue(1);
  const scale = useTransform(scrollY, [-100, 0, 150], [1.12, 1, 1]);

  if (isReducedMotion) {
    return { scale: staticOne, scrollY };
  }

  return { scale, scrollY };
}

/**
 * Reveal Component: fades in with 16px rise using shared spring when scrolled into view.
 * Under reduced motion, content renders immediately without transforms.
 */
export function Reveal({ children, className = '', delay = 0, y = 16 }) {
  const { isReducedMotion } = useMotionPreference();

  if (isReducedMotion) {
    return React.createElement('div', { className }, children);
  }

  return React.createElement(
    motion.div,
    {
      initial: { opacity: 0, y },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, amount: 0.2 },
      transition: {
        type: 'spring',
        damping: 25,
        stiffness: 200,
        delay,
      },
      className,
    },
    children
  );
}

/**
 * useSentinel: encapsulates IntersectionObserver with 400px rootMargin
 * for smooth infinite scroll triggering.
 */
export function useSentinel({ onIntersect, enabled = true, rootMargin = '400px' }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const el = sentinelRef.current;
    if (!el) return;

    if (!('IntersectionObserver' in window)) {
      onIntersect?.();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting) {
          onIntersect?.();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [enabled, onIntersect, rootMargin]);

  return sentinelRef;
}

/**
 * Hero headline stagger animation variants (<600ms total, respects reduced motion)
 */
export const heroHeadlineVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

export const heroLineVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 200,
    },
  },
};

/**
 * Listing row stagger variants (~40ms per batch item)
 */
export const listRowVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: (i % 6) * 0.04,
      type: 'spring',
      damping: 25,
      stiffness: 200,
    },
  }),
};
