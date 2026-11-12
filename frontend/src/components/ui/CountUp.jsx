import React, { useState, useEffect, useRef } from 'react';
import { useSentinel } from '../../lib/scrollMotion';
import { cn } from '../../lib/utils';

/**
 * Animated number counter that counts up when in view.
 * Uses centralized useSentinel from scrollMotion.js.
 * Immediately displays the final value if prefers-reduced-motion is active.
 */
export function CountUp({
  end,
  start = 0,
  duration = 1.2,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}) {
  const target = Number(end) || 0;
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [current, setCurrent] = useState(prefersReducedMotion ? target : start);
  const hasAnimated = useRef(false);

  const startAnimation = () => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    if (prefersReducedMotion || import.meta.env.MODE === 'test') {
      setCurrent(target);
      return;
    }

    let startTime = null;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      const nextVal = start + (target - start) * easeProgress;

      setCurrent(nextVal);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setCurrent(target);
      }
    };

    requestAnimationFrame(step);
  };

  const sentinelRef = useSentinel({
    onIntersect: startAnimation,
    enabled: true,
  });

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      setCurrent(target);
    }
  }, [target]);

  const formatted =
    prefix +
    current.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) +
    suffix;

  return (
    <span
      ref={sentinelRef}
      className={cn('tabular-nums font-medium', className)}
    >
      {formatted}
    </span>
  );
}
