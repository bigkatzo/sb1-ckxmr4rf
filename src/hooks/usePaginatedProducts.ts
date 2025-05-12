import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Product } from '../types/variants';

interface PaginatedProductsOptions {
  initialLimit?: number; // Initial number of items to load
  loadMoreCount?: number; // Number of items to load on "load more"
  preloadThreshold?: number; // How many screens ahead to preload (0-1)
  cacheKey?: string; // Optional key for caching pagination state
}

// This hook handles pagination of products locally
// It takes an array of all products and simulates server pagination
export function usePaginatedProducts(
  allProducts: Product[] = [],
  categoryId: string = '',
  options: PaginatedProductsOptions = {}
) {
  const {
    initialLimit = 12, // Default to 12 products initially
    loadMoreCount = 12, // Load 12 more products at a time
    preloadThreshold = 0.5, // Preload when user is halfway through current batch
    cacheKey = '', // Optional cache key for persistence between sessions
  } = options;

  // Create a cache key combining collection/category info
  const actualCacheKey = `products_${cacheKey}_${categoryId}`;

  // Memoize the filtered products for better performance
  const filteredProducts = useMemo(() => 
    categoryId 
      ? allProducts.filter(product => product.categoryId === categoryId)
      : allProducts,
    [allProducts, categoryId]
  );
  
  // Keep a reference to filtered products
  const filteredAllProducts = useRef<Product[]>([]);
  
  // Update filtered products when dependencies change
  useEffect(() => {
    filteredAllProducts.current = filteredProducts;
  }, [filteredProducts]);

  // Try to restore from sessionStorage on initial mount
  const getInitialState = () => {
    if (typeof window === 'undefined') return [];
    
    try {
      const cached = sessionStorage.getItem(actualCacheKey);
      if (cached) {
        const { ids, timestamp } = JSON.parse(cached);
        
        // Only use cache if it's recent (last 30 minutes)
        const isCacheRecent = Date.now() - timestamp < 30 * 60 * 1000;
        
        if (isCacheRecent && Array.isArray(ids) && ids.length > 0) {
          // Rebuild product array from cached IDs
          const cachedProducts = ids
            .map(id => allProducts.find(p => p.id === id))
            .filter(Boolean) as Product[];
            
          if (cachedProducts.length > 0) {
            return cachedProducts;
          }
        }
      }
    } catch (e) {
      console.warn('Error restoring cached products:', e);
    }
    
    return [];
  };

  const [visibleProducts, setVisibleProducts] = useState<Product[]>(getInitialState);
  const [loading, setLoading] = useState(visibleProducts.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offset = useRef(visibleProducts.length); // Track current offset for pagination
  const isMounted = useRef(true); // Track component mounted state
  const isLoadingRef = useRef(false); // Track loading state to prevent concurrent operations
  const initializedRef = useRef(visibleProducts.length > 0); // Track if initial load has happened
  const lastCategoryId = useRef<string | null>(null); // Track last category ID to detect changes
  const preloadingRef = useRef(false); // Track if we're preloading the next batch
  
  // Save current visible products to session storage for persistence
  useEffect(() => {
    if (visibleProducts.length === 0 || typeof window === 'undefined') return;
    
    try {
      // Only store IDs to keep cache size small
      const productIds = visibleProducts.map(p => p.id);
      sessionStorage.setItem(actualCacheKey, JSON.stringify({
        ids: productIds, 
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Error caching products:', e);
    }
  }, [visibleProducts, actualCacheKey]);
  
  // Function to load more products (or initial load)
  const loadProducts = useCallback((reset = false, isPreloading = false) => {
    // Don't load if already loading or if there's nothing more to load
    if (isLoadingRef.current && !isPreloading) return;
    if (isPreloading) {
      preloadingRef.current = true;
    } else {
      isLoadingRef.current = true;
    }
    
    try {
      if (reset) {
        setLoading(true);
        offset.current = 0;
      } else if (!isPreloading) {
        setLoadingMore(true);
      }
      
      // Get current products based on offset
      const currentProducts = filteredAllProducts.current;
      const limit = reset ? initialLimit : loadMoreCount;
      const currentOffset = reset ? 0 : offset.current;
      
      // Simulate pagination by slicing the array
      const paginatedProducts = currentProducts.slice(
        currentOffset, 
        currentOffset + limit
      );
      
      // Check if there are more products to load
      const moreAvailable = currentOffset + limit < currentProducts.length;
      
      // Update state
      if (isMounted.current) {
        setHasMore(moreAvailable);
        
        // Only update visible products if not preloading
        if (!isPreloading) {
          setVisibleProducts(prevProducts => 
            reset ? paginatedProducts : [...prevProducts, ...paginatedProducts]
          );
        }
        
        // Update offset for next load
        offset.current = reset 
          ? Math.min(initialLimit, paginatedProducts.length)
          : offset.current + paginatedProducts.length;
        
        initializedRef.current = true;
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      if (isMounted.current && !isPreloading) {
        setLoading(false);
        setLoadingMore(false);
      }
      
      if (isPreloading) {
        preloadingRef.current = false;
      } else {
        isLoadingRef.current = false;
      }
    }
  }, [initialLimit, loadMoreCount]);

  // Preload next batch when scrolling
  useEffect(() => {
    // Skip if no more products or already preloading
    if (!hasMore || preloadingRef.current || loadingMore || loading) return;
    
    // Set up scroll listener for preloading
    const handleScroll = () => {
      if (preloadingRef.current || isLoadingRef.current) return;
      
      // Calculate how far down the page the user has scrolled
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      
      // Calculate scroll percentage (0-1)
      const scrollPercentage = (scrollTop + windowHeight) / docHeight;
      
      // If user has scrolled past threshold, preload next batch
      if (scrollPercentage > 1 - preloadThreshold) {
        // Preload next batch silently
        loadProducts(false, true);
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, loading, loadProducts, preloadThreshold]);

  // Reset state when products or category changes
  useEffect(() => {
    const currentProducts = filteredAllProducts.current;
    const categoryChanged = lastCategoryId.current !== categoryId;
    
    // Update the last category ID
    lastCategoryId.current = categoryId;
    
    // If category changed, we need to reset
    if (categoryChanged && initializedRef.current) {
      // Reset pagination
      setVisibleProducts([]);
      offset.current = 0;
      loadProducts(true);
      return;
    }
    
    // For other changes, be more careful with state updates
    if (visibleProducts.length > currentProducts.length) {
      // Products array changed and no longer matches our visible products
      // This can happen when filtering or when data structure changes
      setVisibleProducts(currentProducts.slice(0, Math.min(initialLimit, currentProducts.length)));
      offset.current = Math.min(initialLimit, currentProducts.length);
      setHasMore(currentProducts.length > initialLimit);
    } else if (!initializedRef.current && allProducts.length > 0) {
      // Initial load - set up initial pagination
      loadProducts(true);
    } else if (initializedRef.current) {
      // Update hasMore state based on current products
      setHasMore(offset.current < currentProducts.length);
    }
  }, [allProducts, categoryId, initialLimit, loadProducts, visibleProducts.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Function to load more products
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      loadProducts(false);
    }
  }, [loading, loadingMore, hasMore, loadProducts]);

  // Function to explicitly reset products (for use when navigation occurs)
  const resetProducts = useCallback(() => {
    loadProducts(true);
  }, [loadProducts]);

  return {
    products: visibleProducts,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    resetProducts
  };
} 