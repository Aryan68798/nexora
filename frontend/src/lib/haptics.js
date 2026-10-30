/**
 * Native Haptics Utility using navigator.vibrate
 * Feature-detected, non-throwing, respects user preference and reduced motion.
 *
 * NOTE: iOS Safari does not support the web navigator.vibrate API.
 * This is gracefully handled and acts as a safe no-op.
 */

const STORAGE_KEY = 'nexora_haptics_enabled';

/**
 * Check if haptics are enabled by user in account settings. Default: true.
 */
export function isHapticsEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val !== 'false';
  } catch {
    return true;
  }
}

/**
 * Set haptics enabled/disabled in localStorage.
 */
export function setHapticsEnabled(enabled) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage quota / access exceptions
  }
}

/**
 * Check if reduced motion is preferred by the user.
 */
function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Safely trigger a vibration pattern. Never throws.
 */
function vibrate(pattern) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!navigator.vibrate) return; // iOS Safari / desktop unsupported
  if (!isHapticsEnabled()) return; // User opted out
  if (prefersReducedMotion()) return; // Reduced motion disables haptics

  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore vibration failures
  }
}

export const haptics = {
  /**
   * Light haptic (10ms) - for tab selection, filter chip toggles, favorite toggle
   */
  light() {
    vibrate(10);
  },

  /**
   * Medium haptic (25ms) - for context menu trigger, bottom sheet open/snap
   */
  medium() {
    vibrate(25);
  },

  /**
   * Success haptic ([12, 40, 12]ms) - for successful booking request, payment settlement
   */
  success() {
    vibrate([12, 40, 12]);
  },

  /**
   * Warning / Destructive haptic ([20, 60, 20]ms) - for cancel confirmation
   */
  warning() {
    vibrate([20, 60, 20]);
  },
};
