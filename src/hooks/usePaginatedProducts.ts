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
  options: PaginatedProductsOptions = {},
  sortOption: 'recommended' | 'popular' | 'newest' | 'price' = 'recommended'
) {
  const {
    initialLimit = 12, // Default to 12 products initially
    loadMoreCount = 12, // Load 12 more products at a time
    preloadThreshold = 0.5, // Preload when user is halfway through current batch
    cacheKey = '', // Optional cache key for persistence between sessions
  } = options;

  // Create a cache key combining collection/category info but NOT sort option
  const actualCacheKey = `products_${cacheKey}_${categoryId}_v3`;

  // Clear all product caches for this collection
  const clearProductCaches = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Find all keys related to this collection
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(`products_${cacheKey}`)) {
          keysToRemove.push(key);
        }
      }
      
      // Remove all related cache entries
      keysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
        console.log(`Cleared cache: ${key}`);
      });
    } catch (e) {
      console.warn('Error clearing product caches:', e);
    }
  }, [cacheKey]);

  // When sort option changes, clear caches
  useEffect(() => {
    console.log(`Sort changed to ${sortOption}`);
  }, [sortOption]);

  // Add logging for debug purposes
  useEffect(() => {
    console.log(`Sort option changed to: ${sortOption}`);
    console.log(`Cache key updated: ${actualCacheKey}`);
    // Log some stats about the products to help debug
    if (allProducts.length > 0) {
      const pinnedProducts = allProducts.filter(p => p.pinOrder !== undefined && p.pinOrder !== null && p.pinOrder > 0);
      console.log(`Total products: ${allProducts.length}, Pinned: ${pinnedProducts.length}`);
      
      if (pinnedProducts.length > 0) {
        console.log('All pinned products:', pinnedProducts.map(p => ({
          id: p.id.substring(0, 6),
          name: p.name,
          pinOrder: p.pinOrder
        })));
      }
      
      // Log first few products with their sort-relevant properties
      const sampleProducts = allProducts.slice(0, Math.min(5, allProducts.length));
      console.log('Sample product data:', sampleProducts.map(p => ({
        id: p.id.substring(0, 6),
        name: p.name,
        pinOrder: p.pinOrder,
        salesCount: p.salesCount,
        price: p.price,
        type: typeof p.pinOrder
      })));
    }
  }, [sortOption, actualCacheKey, allProducts.length]);

  // Memoize the filtered products for better performance
  const filteredProducts = useMemo(() => {
    // First filter by category if specified
    const filtered = categoryId 
      ? allProducts.filter(product => product.categoryId === categoryId)
      : allProducts;
    
    console.log('Sorting products with sort option:', sortOption);
    
    // For 'recommended' sort, handle pinned products separately
    if (sortOption === 'recommended') {
      // Separate pinned and unpinned products
      // Only consider valid pin orders (1, 2, 3, etc.)
      const pinnedProducts = filtered.filter(product => {
        const hasPinOrder = product.pinOrder !== undefined && product.pinOrder !== null;
        const isValidPinOrder = hasPinOrder && Number(product.pinOrder) > 0;
        return isValidPinOrder;
      });
      
      const unpinnedProducts = filtered.filter(product => {
        const hasPinOrder = product.pinOrder !== undefined && product.pinOrder !== null;
        const isValidPinOrder = hasPinOrder && Number(product.pinOrder) > 0;
        return !isValidPinOrder;
      });
      
      console.log(`Sorting ${pinnedProducts.length} pinned products and ${unpinnedProducts.length} unpinned products`);
      
      // Sort pinned products by their pin order
      const sortedPinnedProducts = [...pinnedProducts].sort((a, b) => {
        // Ensure we have valid pinOrder values
        const aOrder = Number(a.pinOrder);
        const bOrder = Number(b.pinOrder);
        console.log(`Comparing pinOrder: ${aOrder} vs ${bOrder}`);
        return aOrder - bOrder;
      });
      
      // Log the sorted pinned products
      if (sortedPinnedProducts.length > 0) {
        console.log('Sorted pinned products:', sortedPinnedProducts.map(p => ({
          id: p.id.substring(0, 6),
          name: p.name,
          pinOrder: p.pinOrder
        })));
      }
      
      // Sort unpinned products by sales count first, then by creation date (newer first)
      const sortedUnpinnedProducts = [...unpinnedProducts].sort((a, b) => {
        // First compare by public order count (higher first)
        // For the recommended sort, we're using the 'publicOrderCount' property 
        // that comes from the public_order_counts view
        const aOrderCount = a.publicOrderCount || 0;
        const bOrderCount = b.publicOrderCount || 0;
        const orderCountCompare = bOrderCount - aOrderCount;
        
        // If publicOrderCount doesn't exist, fall back to salesCount
        if (orderCountCompare === 0) {
          const salesCompare = (b.salesCount || 0) - (a.salesCount || 0);
          
          // If sales count is the same, sort by creation date (using ID as proxy for creation time)
          if (salesCompare === 0) {
            return b.id.localeCompare(a.id);
          }
          
          return salesCompare;
        }
        
        return orderCountCompare;
      });
      
      // Combine the pinned products (at the top) with the sorted unpinned products
      const result = [...sortedPinnedProducts, ...sortedUnpinnedProducts];
      console.log('Final sorted list first 3 items:', result.slice(0, 3).map(p => ({
        id: p.id.substring(0, 6),
        name: p.name,
        pinOrder: p.pinOrder,
        publicOrderCount: p.publicOrderCount,
        salesCount: p.salesCount
      })));
      
      return result;
    } else {
      // For all other sort options, ignore pinned status
      const sortedProducts = [...filtered].sort((a, b) => {
        switch (sortOption) {
          case 'popular':
            // Sort by public order count (higher first), which is the count of confirmed, shipped, delivered orders
            // This ensures consistency with the Best Sellers section on the homepage
            const aOrderCount = a.publicOrderCount || 0;
            const bOrderCount = b.publicOrderCount || 0;
            
            // Debug public order counts
            console.log(`Popular sort comparing: ${a.name} (${aOrderCount}) vs ${b.name} (${bOrderCount})`);
            
            // If order counts are equal, fall back to salesCount
            if (aOrderCount === bOrderCount) {
              const aSales = a.salesCount || 0;
              const bSales = b.salesCount || 0;
              return bSales - aSales;
            }
            
            return bOrderCount - aOrderCount;
          case 'newest':
            // Sort by creation date (newer first)
            // If we have created_at timestamps, use those
            if (a.createdAt && b.createdAt) {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            // Fall back to using ID as proxy for creation time
            return b.id.localeCompare(a.id);
          case 'price':
            // Sort by price (lower first)
            const aPrice = a.price || 0;
            const bPrice = b.price || 0;
            return aPrice - bPrice;
          default:
            return 0;
        }
      });

      // Log the sorted results for debugging
      console.log(`Sorted by ${sortOption}, first 3 items:`, sortedProducts.slice(0, 3).map(p => ({
        id: p.id.substring(0, 6),
        name: p.name,
        [sortOption === 'popular' ? 'publicOrderCount' : sortOption === 'price' ? 'price' : 'id']: 
          sortOption === 'popular' ? p.publicOrderCount : 
          sortOption === 'price' ? p.price : p.id,
        salesCount: p.salesCount
      })));
      
      return sortedProducts;
    }
  }, [allProducts, categoryId, sortOption]);
  
  // Keep a reference to filtered products and update immediately when dependencies change
  const filteredAllProducts = useRef<Product[]>([]);
  
  // Update filtered products when dependencies change
  useEffect(() => {
    filteredAllProducts.current = filteredProducts;
    
    // When sort option changes, force a reset of visible products
    if (initializedRef.current) {
      const currentProducts = filteredProducts;
      if (currentProducts.length > 0) {
        const initialBatch = currentProducts.slice(0, Math.min(initialLimit, currentProducts.length));
        setVisibleProducts(initialBatch);
        offset.current = initialBatch.length;
        setHasMore(currentProducts.length > initialBatch.length);
      }
    }
  }, [filteredProducts, initialLimit]);

  // State for visible products and pagination
  const [visibleProducts, setVisibleProducts] = useState<Product[]>(() => {
    // Try to restore from cache first
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(actualCacheKey);
        if (cached) {
          const { products: cachedProducts } = JSON.parse(cached);
          // Find products in allProducts array by ID
          const restoredProducts = cachedProducts
            .map((id: string) => allProducts.find(p => p.id === id))
            .filter(Boolean);
          return restoredProducts;
        }
      } catch (e) {
        console.warn('Error restoring from cache:', e);
      }
    }
    return [];
  });

  const [loading, setLoading] = useState(visibleProducts.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offset = useRef(visibleProducts.length); // Track current offset for pagination
  const isMounted = useRef(true); // Track component mounted state
  const isLoadingRef = useRef(false); // Track loading state to prevent concurrent operations
  const initializedRef = useRef(visibleProducts.length > 0); // Track if initial load has happened
  const lastCategoryId = useRef<string | null>(null); // Track last category ID to detect changes
  const preloadingRef = useRef(false); // Track if we're preloading the next batch
  const prevSortRef = useRef<string | null>(null); // Track previous sort option
  
  // Save current visible products to session storage for persistence
  useEffect(() => {
    if (visibleProducts.length === 0 || typeof window === 'undefined') return;
    
    try {
      // Only store IDs to keep cache size small
      const productIds = visibleProducts.map(p => p.id);
      sessionStorage.setItem(actualCacheKey, JSON.stringify({
        products: productIds,
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
        
        // When resetting, clear any old cache from sessionStorage
        try {
          sessionStorage.removeItem(actualCacheKey);
          console.log(`Reset: Cleared cache for ${actualCacheKey}`);
        } catch (e) {
          console.warn('Error clearing cached products:', e);
        }
      } else if (!isPreloading) {
        setLoadingMore(true);
      }
      
      // Get current products based on offset
      const currentProducts = filteredProducts; // Use filteredProducts directly
      
      // Log the current state for debugging
      console.log(`Loading products - Total available: ${currentProducts.length}, Current offset: ${offset.current}, Is reset: ${reset}`);
      
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
        console.log(`Updated state - Visible products: ${paginatedProducts.length}, Has more: ${moreAvailable}, Next offset: ${currentOffset + paginatedProducts.length}`);
        
        // Only update visible products if not preloading
        if (!isPreloading) {
          setVisibleProducts(prevProducts => 
            reset ? paginatedProducts : [...prevProducts, ...paginatedProducts]
          );
        }
        
        // Update offset for next load
        offset.current = currentOffset + paginatedProducts.length;
        console.log(`Updating hasMore state - Offset: ${offset.current}, Total: ${currentProducts.length}, Has more: ${moreAvailable}`);
        
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
  }, [initialLimit, loadMoreCount, filteredProducts, actualCacheKey]);

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
    const currentProducts = filteredProducts;
    const categoryChanged = lastCategoryId.current !== categoryId;
    
    // Update the last category ID
    lastCategoryId.current = categoryId;
    
    // If category changed or sort option changed, we need to reset
    if ((categoryChanged || sortOption !== prevSortRef.current) && initializedRef.current) {
      prevSortRef.current = sortOption;
      // Reset pagination
      setVisibleProducts([]);
      offset.current = 0;
      loadProducts(true);
      return;
    }
    
    // For other changes, be more careful with state updates
    if (visibleProducts.length > currentProducts.length) {
      // Products array changed and no longer matches our visible products
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
  }, [allProducts, categoryId, initialLimit, loadProducts, visibleProducts.length, sortOption, filteredProducts]);

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
    console.log(`Explicitly resetting products with sort: ${sortOption}`);
    
    // Clear all caches first
    clearProductCaches();
    
    // Then load products with reset flag
    loadProducts(true);
  }, [loadProducts, sortOption, clearProductCaches]);

  return {
    products: visibleProducts,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    resetProducts
  };
} 