import { useEffect, useState, RefObject } from 'react';

export interface UseInViewOptions {
  threshold?: number;
  rootMargin?: string;
  root?: Element | null;
  ref?: RefObject<Element>;
}

export function useInView({ threshold = 0, rootMargin = '0px', root = null, ref }: UseInViewOptions = {}) {
  const [isInView, setIsInView] = useState(false);
  const [hasBeenInView, setHasBeenInView] = useState(false);

  useEffect(() => {
    if (!ref?.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
        if (entry.isIntersecting) {
          setHasBeenInView(true);
        }
      },
      { threshold, rootMargin, root }
    );

    observer.observe(ref.current);

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold, rootMargin, root, ref]);

  return { isInView, hasBeenInView };
} 