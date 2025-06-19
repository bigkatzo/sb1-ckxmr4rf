import { useEffect, useRef } from 'react';

// Global state to track how many components are preventing scroll
let scrollPreventCount = 0;
let globalScrollY = 0;
let globalOriginalStyles: {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  paddingRight: string;
} = {
  overflow: '',
  position: '',
  top: '',
  left: '',
  right: '',
  width: '',
  paddingRight: ''
};

export function usePreventScroll(prevent: boolean) {
  const wasPreventingRef = useRef(false);

  useEffect(() => {
    // Prevent touch scrolling on iOS while allowing modal content to scroll
    const preventTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // Allow scrolling within modal content areas
      const allowedSelectors = [
        '.modal-content',
        '.modal-scrollable',
        '[data-modal-scrollable]',
        '.overflow-y-auto',
        '.overflow-auto'
      ];
      
      const isScrollableArea = allowedSelectors.some(selector => 
        target.closest(selector)
      );
      
      if (!isScrollableArea) {
        e.preventDefault();
      }
    };

    if (prevent && !wasPreventingRef.current) {
      // Starting to prevent scroll
      scrollPreventCount++;
      wasPreventingRef.current = true;
      
      // Only apply styles if this is the first component to prevent scroll
      if (scrollPreventCount === 1) {
        // Store current scroll position and original styles
        globalScrollY = window.scrollY;
        
        const body = document.body;
        const html = document.documentElement;
        
        // Store original styles before any modifications
        globalOriginalStyles = {
          overflow: body.style.overflow || '',
          position: body.style.position || '',
          top: body.style.top || '',
          left: body.style.left || '',
          right: body.style.right || '',
          width: body.style.width || '',
          paddingRight: body.style.paddingRight || ''
        };

        // Calculate scrollbar width to prevent layout shift
        const scrollBarWidth = window.innerWidth - html.clientWidth;
        
        // Apply scroll lock styles with multiple fallbacks for mobile
        body.style.overflow = 'hidden';
        body.style.position = 'fixed';
        body.style.top = `-${globalScrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
        
        // Prevent layout shift by adding padding for scrollbar
        if (scrollBarWidth > 0) {
          body.style.paddingRight = `${scrollBarWidth}px`;
        }
        
        // Additional mobile scroll prevention
        html.style.overflow = 'hidden';
        
        // Add touch event listeners for iOS
        document.addEventListener('touchmove', preventTouchMove, { passive: false });
      }
    } else if (!prevent && wasPreventingRef.current) {
      // Stopping scroll prevention
      scrollPreventCount = Math.max(0, scrollPreventCount - 1);
      wasPreventingRef.current = false;
      
      // Only restore styles if no other components are preventing scroll
      if (scrollPreventCount === 0) {
        const body = document.body;
        const html = document.documentElement;
        
        // Restore original styles
        body.style.overflow = globalOriginalStyles.overflow;
        body.style.position = globalOriginalStyles.position;
        body.style.top = globalOriginalStyles.top;
        body.style.left = globalOriginalStyles.left;
        body.style.right = globalOriginalStyles.right;
        body.style.width = globalOriginalStyles.width;
        body.style.paddingRight = globalOriginalStyles.paddingRight;
        
        html.style.overflow = '';
        
        // Remove touch event listeners
        document.removeEventListener('touchmove', preventTouchMove);
        
        // Restore scroll position
        window.scrollTo(0, globalScrollY);
        
        // Reset global state
        globalScrollY = 0;
        globalOriginalStyles = {
          overflow: '',
          position: '',
          top: '',
          left: '',
          right: '',
          width: '',
          paddingRight: ''
        };
      }
    }
    
    // Cleanup function - ensures proper cleanup even if component unmounts unexpectedly
    return () => {
      if (wasPreventingRef.current) {
        scrollPreventCount = Math.max(0, scrollPreventCount - 1);
        wasPreventingRef.current = false;
        
        // If this was the last component preventing scroll, restore everything
        if (scrollPreventCount === 0) {
          const body = document.body;
          const html = document.documentElement;
          
          // Restore original styles
          body.style.overflow = globalOriginalStyles.overflow;
          body.style.position = globalOriginalStyles.position;
          body.style.top = globalOriginalStyles.top;
          body.style.left = globalOriginalStyles.left;
          body.style.right = globalOriginalStyles.right;
          body.style.width = globalOriginalStyles.width;
          body.style.paddingRight = globalOriginalStyles.paddingRight;
          
          html.style.overflow = '';
          
          // Remove touch event listeners
          document.removeEventListener('touchmove', preventTouchMove);
          
          // Restore scroll position
          window.scrollTo(0, globalScrollY);
          
          // Reset global state
          globalScrollY = 0;
          globalOriginalStyles = {
            overflow: '',
            position: '',
            top: '',
            left: '',
            right: '',
            width: '',
            paddingRight: ''
          };
        }
      }
    };
  }, [prevent]);
}