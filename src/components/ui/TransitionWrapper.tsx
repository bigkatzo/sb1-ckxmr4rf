import { ReactNode, useEffect, useState } from 'react';

interface TransitionWrapperProps {
  children: ReactNode;
  identifier: string | number;
  className?: string;
  duration?: number;
}

/**
 * A wrapper component that provides smooth transitions when content changes
 * 
 * @param children The content to display
 * @param identifier A unique identifier that changes when content changes
 * @param className Additional classes to apply to the wrapper
 * @param duration The transition duration in milliseconds (default: 300)
 */
export function TransitionWrapper({ 
  children, 
  identifier, 
  className = '',
  duration = 300
}: TransitionWrapperProps) {
  const [previousChildren, setPreviousChildren] = useState<ReactNode>(children);
  const [previousIdentifier, setPreviousIdentifier] = useState<string | number>(identifier);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  useEffect(() => {
    // Only trigger transition when identifier changes
    if (identifier !== previousIdentifier) {
      setIsTransitioning(true);
      
      // After a short delay, update the previous children
      const timer = setTimeout(() => {
        setPreviousChildren(children);
        setPreviousIdentifier(identifier);
        setIsTransitioning(false);
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [children, identifier, previousIdentifier, duration]);
  
  // Calculate the opacity style based on transition state
  const style = {
    transition: `opacity ${duration}ms ease-in-out`,
    opacity: isTransitioning ? 0 : 1
  };
  
  return (
    <div className={className} style={style}>
      {isTransitioning ? previousChildren : children}
    </div>
  );
} 