import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollBehavior() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Extract the path segments
    const segments = pathname.split('/').filter(Boolean);
    
    // Don't scroll to top when navigating between collection and its products
    // Collection path format: /:collectionSlug
    // Product path format: /:collectionSlug/:productSlug
    const isCollectionProductNavigation = 
      // Current path is product page and previous was collection
      (segments.length === 2 && localStorage.getItem('prevPath') === `/${segments[0]}`) ||
      // Current path is collection and previous was its product
      (segments.length === 1 && localStorage.getItem('prevPath')?.startsWith(`/${segments[0]}/`));

    // Store current path for next navigation
    localStorage.setItem('prevPath', pathname);

    // Scroll to top only if not navigating between collection and its products
    if (!isCollectionProductNavigation) {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
} 