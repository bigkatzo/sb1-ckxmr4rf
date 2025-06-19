import { useEffect, useRef } from 'react';

// Global state to track scroll prevention
let scrollPreventCount = 0;

export function usePreventScroll(prevent: boolean) {
  const wasPreventingRef = useRef(false);

  useEffect(() => {
    if (prevent && !wasPreventingRef.current) {
      // Starting scroll prevention
      scrollPreventCount++;
      wasPreventingRef.current = true;
      
      // Apply scroll prevention
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Store original touch-action
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.touchAction = 'none';
      
      return () => {
        // Cleanup when unmounting or when prevent becomes false
        scrollPreventCount = Math.max(0, scrollPreventCount - 1);
        wasPreventingRef.current = false;
        
        if (scrollPreventCount === 0) {
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
          document.body.style.touchAction = originalTouchAction;
        }
      };
    }
  }, [prevent]);
}