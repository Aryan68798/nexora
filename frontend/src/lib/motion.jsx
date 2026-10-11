/**
 * Nexora Native Motion & Springs System
 * Provides standardized springs, reduced-motion preferences, and press feedback.
 */

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Standard Spring Configurations
 */
export const defaultSpring = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 1,
};

export const softSpring = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 1,
};

export const snappySpring = {
  type: 'spring',
  stiffness: 500,
  damping: 32,
  mass: 0.8,
};

/**
 * Opacity Transition (durations only for opacity, max 180ms)
 */
export const opacityTransition = {
  duration: 0.18,
  ease: 'easeOut',
};

/**
 * Standard Press Feedback configuration (scales to 0.97 on press with spring)
 */
export const pressFeedback = {
  scale: 0.97,
  transition: snappySpring,
};

/**
 * Unified Reduced Motion Hook
 */
export function useMotionPreference() {
  const shouldReduce = useReducedMotion();
  const isReducedMotion = Boolean(shouldReduce);

  return {
    isReducedMotion,
    spring: isReducedMotion ? { duration: 0.01 } : defaultSpring,
    softSpring: isReducedMotion ? { duration: 0.01 } : softSpring,
    snappySpring: isReducedMotion ? { duration: 0.01 } : snappySpring,
    opacityTransition: isReducedMotion ? { duration: 0.05 } : opacityTransition,
    tapFeedback: isReducedMotion ? undefined : pressFeedback,
  };
}

/**
 * Fast Page Transition (Fade + subtle 8px rise on enter, instant on reduced)
 */
export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: defaultSpring,
  },
  exit: {
    opacity: 0,
    transition: opacityTransition,
  },
};

export function PageTransition({ children, className = '' }) {
  const { isReducedMotion } = useMotionPreference();

  if (isReducedMotion) {
    return <div className={`w-full ${className}`}>{children}</div>;
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`w-full ${className}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Backwards compatibility exports for existing components
 */
export const transitions = {
  spring: defaultSpring,
  gentleSpring: softSpring,
  smooth: defaultSpring,
  fast: opacityTransition,
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: defaultSpring,
  },
};
