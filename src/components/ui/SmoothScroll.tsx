import React, { useRef, useEffect } from 'react';

interface SmoothScrollProps {
  children: React.ReactNode;
  className?: string;
  hideScrollbar?: boolean;
}

export function SmoothScroll({ children, className = '', hideScrollbar = false }: SmoothScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    // Add passive event listeners for better performance
    const options = { passive: true };

    // Use requestAnimationFrame for smoother scrolling
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Optimization logic can be added here if needed
          ticking = false;
        });
        ticking = true;
      }
    };

    scrollElement.addEventListener('scroll', handleScroll, options);
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollbarClasses = hideScrollbar 
    ? 'scrollbar-hide' 
    : 'scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700';

  return (
    <div 
      ref={scrollRef}
      className={`overflow-y-auto scroll-smooth ${scrollbarClasses} ${className}`}
    >
      {children}
    </div>
  );
} 