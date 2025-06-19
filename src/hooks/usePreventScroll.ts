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
  height: string;
} = {
  overflow: '',
  position: '',
  top: '',
  left: '',
  right: '',
  width: '',
  paddingRight: '',
  height: ''
};

let touchMoveHandler: ((e: TouchEvent) => void) | null = null;

export function usePreventScroll(prevent: boolean) {
  const wasPreventingRef = useRef(false);

  useEffect(() => {
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
          paddingRight: body.style.paddingRight || '',
          height: body.style.height || ''
        };

        // Calculate scrollbar width to prevent layout shift
        const scrollBarWidth = window.innerWidth - html.clientWidth;
        
        // Apply comprehensive scroll lock styles
        body.style.overflow = 'hidden';
        body.style.position = 'fixed';
        body.style.top = `-${globalScrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';
        body.style.height = '100%';
        
        // Prevent layout shift by adding padding for scrollbar
        if (scrollBarWidth > 0) {
          body.style.paddingRight = `${scrollBarWidth}px`;
        }
        
        // Additional comprehensive mobile scroll prevention
        html.style.overflow = 'hidden';
        html.style.position = 'fixed';
        html.style.height = '100%';
        html.style.width = '100%';
        
        // Enhanced touch event prevention for all mobile devices
        touchMoveHandler = (e: TouchEvent) => {
          const target = e.target as HTMLElement;
          
          // Allow scrolling within specific modal content areas
          const allowedSelectors = [
            '.modal-content',
            '.modal-scrollable',
            '[data-modal-scrollable]',
            '.overflow-y-auto',
            '.overflow-auto',
            '[data-allow-scroll="true"]',
            'button',
            'input',
            'textarea',
            'select',
            '[role="button"]',
            '[tabindex]'
          ];
          
          const isScrollableArea = allowedSelectors.some(selector => 
            target.closest(selector)
          );
          
          // Prevent all touch scrolling outside allowed areas
          if (!isScrollableArea) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        };
        
        // Only prevent touchmove (not touchstart/touchend which are needed for clicks)
        document.addEventListener('touchmove', touchMoveHandler, { passive: false });
        
        // Prevent wheel scrolling on desktop
        const wheelHandler = (e: WheelEvent) => {
          const target = e.target as HTMLElement;
          const allowedSelectors = [
            '.modal-content',
            '.modal-scrollable',
            '[data-modal-scrollable]',
            '.overflow-y-auto',
            '.overflow-auto',
            '[data-allow-scroll="true"]'
          ];
          
          const isScrollableArea = allowedSelectors.some(selector => 
            target.closest(selector)
          );
          
          if (!isScrollableArea) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        };
        
        document.addEventListener('wheel', wheelHandler, { passive: false });
        
        // Store handlers globally for cleanup
        (window as any).__modalTouchHandler = touchMoveHandler;
        (window as any).__modalWheelHandler = wheelHandler;
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
        body.style.height = globalOriginalStyles.height;
        
        html.style.overflow = '';
        html.style.position = '';
        html.style.height = '';
        html.style.width = '';
        
        // Remove all event listeners
        const storedTouchHandler = (window as any).__modalTouchHandler;
        const storedWheelHandler = (window as any).__modalWheelHandler;
        
        if (storedTouchHandler) {
          document.removeEventListener('touchmove', storedTouchHandler);
        }
        
        if (storedWheelHandler) {
          document.removeEventListener('wheel', storedWheelHandler);
        }
        
        // Clean up global references
        delete (window as any).__modalTouchHandler;
        delete (window as any).__modalWheelHandler;
        
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
          paddingRight: '',
          height: ''
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
          body.style.height = globalOriginalStyles.height;
          
          html.style.overflow = '';
          html.style.position = '';
          html.style.height = '';
          html.style.width = '';
          
          // Remove all event listeners
          const storedTouchHandler = (window as any).__modalTouchHandler;
          const storedWheelHandler = (window as any).__modalWheelHandler;
          
          if (storedTouchHandler) {
            document.removeEventListener('touchmove', storedTouchHandler);
          }
          
          if (storedWheelHandler) {
            document.removeEventListener('wheel', storedWheelHandler);
          }
          
          // Clean up global references
          delete (window as any).__modalTouchHandler;
          delete (window as any).__modalWheelHandler;
          
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
            paddingRight: '',
            height: ''
          };
        }
      }
    };
  }, [prevent]);
}