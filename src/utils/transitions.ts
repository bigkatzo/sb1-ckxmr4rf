/**
 * Shared transition configurations for consistent animations throughout the app
 */

// Default timing values (in ms)
export const TIMING = {
  FAST: 150,
  MEDIUM: 250,
  SLOW: 350,
  STAGGER: 30, // Delay between staggered items
};

// Default easing functions
export const EASING = {
  // Standard easing
  STANDARD: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  // For elements entering the screen
  ENTRANCE: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  // For elements leaving the screen
  EXIT: 'cubic-bezier(0.4, 0.0, 1, 1)',
  // For elements that need to move beyond their bounds then return (slight spring effect)
  SPRING: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// Page transition variants - for consistent page to page transitions
export const pageTransitionVariants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: TIMING.MEDIUM / 1000, // Convert to seconds for framer-motion
      ease: EASING.ENTRANCE,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: TIMING.FAST / 1000,
      ease: EASING.EXIT,
    },
  },
};

// Modal transition variants
export const modalTransitionVariants = {
  initial: {
    opacity: 0,
    scale: 0.96,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: TIMING.MEDIUM / 1000,
      ease: EASING.ENTRANCE,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: {
      duration: TIMING.FAST / 1000,
      ease: EASING.EXIT,
    },
  },
};

// Staggered children animation variants
export const staggeredChildrenVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: TIMING.MEDIUM / 1000,
      ease: EASING.STANDARD,
      delay: index * (TIMING.STAGGER / 1000),
    },
  }),
};

// Helper function to get CSS transition string
export const getTransition = (
  properties: string[] = ['all'],
  duration: number = TIMING.MEDIUM,
  easing: string = EASING.STANDARD
): string => {
  return properties.map(prop => `${prop} ${duration}ms ${easing}`).join(', ');
};

// CSS style for preventing layout shifts during animations
export const layoutStabilityStyles = {
  backfaceVisibility: 'hidden',
  transform: 'translateZ(0)',
  willChange: 'opacity, transform',
}; 