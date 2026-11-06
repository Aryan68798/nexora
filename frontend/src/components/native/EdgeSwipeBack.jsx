import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { haptics } from '../../lib/haptics';

/**
 * EdgeSwipeBack Component
 * Listens for touch start near the left screen edge (<30px)
 * and navigates back if swiped right (>60px).
 */
export function EdgeSwipeBack({ children, fallbackPath }) {
  const navigate = useNavigate();
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isValidEdgeStartRef = useRef(false);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    if (touch.clientX < 32) {
      isValidEdgeStartRef.current = true;
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
    } else {
      isValidEdgeStartRef.current = false;
    }
  };

  const handleTouchEnd = (e) => {
    if (!isValidEdgeStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = Math.abs(touch.clientY - startYRef.current);

    // If moved right > 65px and horizontally more than vertically
    if (deltaX > 65 && deltaX > deltaY) {
      haptics.light();
      if (fallbackPath && window.history.length <= 1) {
        navigate(fallbackPath);
      } else {
        navigate(-1);
      }
    }
    isValidEdgeStartRef.current = false;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full h-full"
    >
      {children}
    </div>
  );
}
