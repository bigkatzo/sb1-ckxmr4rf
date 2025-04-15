import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollBehavior() {
  const { pathname } = useLocation();
  const prevPathRef = useRef<string | null>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    // Load previous positions from storage on mount
    try {
      const savedPositions = localStorage.getItem('scrollPositions');
      if (savedPositions) {
        scrollPositionsRef.current = JSON.parse(savedPositions);
      }
    } catch (err) {
      console.error('Failed to load scroll positions:', err);
    }

    // Save scroll position when unmounting
    return () => {
      try {
        localStorage.setItem('scrollPositions', JSON.stringify(scrollPositionsRef.current));
      } catch (err) {
        console.error('Failed to save scroll positions:', err);
      }
    };
  }, []);
  
  useEffect(() => {
    // Extract the path segments
    const segments = pathname.split('/').filter(Boolean);
    
    // Get previous path reference from ref
    const prevPath = prevPathRef.current;
    
    // Don't scroll to top when navigating between collection and its products
    // Collection path format: /:collectionSlug
    // Product path format: /:collectionSlug/:productSlug
    const isCollectionProductNavigation = 
      // Current path is product page and previous was collection
      (segments.length === 2 && prevPath === `/${segments[0]}`) ||
      // Current path is collection and previous was its product
      (segments.length === 1 && prevPath?.startsWith(`/${segments[0]}/`));

    // Save current position before navigating away
    if (prevPath) {
      scrollPositionsRef.current[prevPath] = window.scrollY;
    }
    
    // Update previous path reference
    prevPathRef.current = pathname;

    // Handle scrolling behavior
    if (isCollectionProductNavigation) {
      // For collection-product navigation, use smooth scrolling if going back to collection
      if (segments.length === 1 && prevPath?.startsWith(`/${segments[0]}/`)) {
        const savedPosition = scrollPositionsRef.current[pathname] || 0;
        // Use requestAnimationFrame for smoother transition
        requestAnimationFrame(() => {
          window.scrollTo({
            top: savedPosition,
            behavior: 'smooth'
          });
        });
      }
    } else {
      // For other navigation, immediately scroll to top with no animation
      // This prevents jarring when new content is loading
      window.scrollTo(0, 0);
    }

    // Store current path in localStorage for persistence across page reloads
    localStorage.setItem('prevPath', pathname);
  }, [pathname]);

  return null;
} 