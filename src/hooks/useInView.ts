import { useEffect, useRef, useState } from 'react';

interface UseInViewOptions {
  rootMargin?: string;
  threshold?: number;
  root?: Element | null;
}

export function useInView<T extends Element>({
  rootMargin = '50px',
  threshold = 0,
  root = null
}: UseInViewOptions = {}) {
  const [isInView, setIsInView] = useState(false);
  const [hasBeenInView, setHasBeenInView] = useState(false);
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setIsInView(isVisible);
        if (isVisible && !hasBeenInView) {
          setHasBeenInView(true);
        }
      },
      { rootMargin, threshold, root }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  }, [rootMargin, threshold, root, hasBeenInView]);

  return { ref: elementRef, isInView, hasBeenInView };
} 