import { useEffect, useRef } from 'react';

export function usePreventScroll(prevent: boolean) {
  const scrollY = useRef(0);
  const originalStyles = useRef({
    overflow: '',
    position: '',
    top: '',
    left: '',
    right: '',
    width: '',
    paddingRight: ''
  });

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

    // Store current scroll position and original styles only when locking
    if (prevent) {
      scrollY.current = window.scrollY;
      
      // Store original styles
      const body = document.body;
      const html = document.documentElement;
      
      originalStyles.current = {
        overflow: body.style.overflow,
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        paddingRight: body.style.paddingRight
      };

      // Calculate scrollbar width to prevent layout shift
      const scrollBarWidth = window.innerWidth - html.clientWidth;
      
      // Apply scroll lock styles with multiple fallbacks for mobile
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${scrollY.current}px`;
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
    
    // Always return cleanup function
    return () => {
      const body = document.body;
      const html = document.documentElement;
      
      // Only restore styles and scroll if we were previously preventing scroll
      if (prevent) {
        // Restore original styles
        body.style.overflow = originalStyles.current.overflow;
        body.style.position = originalStyles.current.position;
        body.style.top = originalStyles.current.top;
        body.style.left = originalStyles.current.left;
        body.style.right = originalStyles.current.right;
        body.style.width = originalStyles.current.width;
        body.style.paddingRight = originalStyles.current.paddingRight;
        
        html.style.overflow = '';
        
        // Remove touch event listeners
        document.removeEventListener('touchmove', preventTouchMove);
        
        // Restore scroll position
        window.scrollTo(0, scrollY.current);
      }
    };
  }, [prevent]);
}