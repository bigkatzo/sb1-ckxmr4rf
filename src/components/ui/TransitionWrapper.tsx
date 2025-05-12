import { ReactNode, useEffect, useState, useRef } from 'react';

interface TransitionWrapperProps {
  children: ReactNode;
  identifier: string | number;
  className?: string;
  duration?: number;
  maintainSize?: boolean;
}

/**
 * A wrapper component that provides smooth transitions when content changes
 * 
 * @param children The content to display
 * @param identifier A unique identifier that changes when content changes
 * @param className Additional classes to apply to the wrapper
 * @param duration The transition duration in milliseconds (default: 300)
 * @param maintainSize Whether to maintain the size during transition (default: true)
 */
export function TransitionWrapper({ 
  children, 
  identifier, 
  className = '',
  duration = 300,
  maintainSize = true
}: TransitionWrapperProps) {
  const [previousChildren, setPreviousChildren] = useState<ReactNode>(children);
  const [previousIdentifier, setPreviousIdentifier] = useState<string | number>(identifier);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 'auto', height: 'auto' });
  
  useEffect(() => {
    // Only trigger transition when identifier changes
    if (identifier !== previousIdentifier) {
      // If we want to maintain size, capture current dimensions before transition
      if (maintainSize && containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        setDimensions({
          width: `${offsetWidth}px`,
          height: `${offsetHeight}px`
        });
      }
      
      setIsTransitioning(true);
      
      // After a short delay, update the previous children
      const timer = setTimeout(() => {
        setPreviousChildren(children);
        setPreviousIdentifier(identifier);
        setIsTransitioning(false);
        
        // Reset dimensions after transition
        if (maintainSize) {
          setDimensions({ width: 'auto', height: 'auto' });
        }
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [children, identifier, previousIdentifier, duration, maintainSize]);
  
  // Calculate the style based on transition state
  const style = {
    transition: `opacity ${duration}ms ease-in-out`,
    opacity: isTransitioning ? 0 : 1,
    ...(maintainSize && isTransitioning ? {
      width: dimensions.width,
      height: dimensions.height,
      overflow: 'hidden'
    } : {})
  };
  
  return (
    <div ref={containerRef} className={className} style={style}>
      {isTransitioning ? previousChildren : children}
    </div>
  );
} 