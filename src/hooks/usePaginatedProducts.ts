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

  // State for visible products and pagination
  const [visibleProducts, setVisibleProducts] = useState<Product[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(actualCacheKey);
        if (cached) {
          const { products: cachedProductIds } = JSON.parse(cached);
          return allProducts.filter(p => cachedProductIds.includes(p.id));
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

  // First filter products by category
  const filteredByCategory = useMemo(() => {
    return categoryId 
      ? allProducts.filter(product => product.categoryId === categoryId)
      : allProducts;
  }, [allProducts, categoryId]);

  // Then sort the filtered products
  const sortedProducts = useMemo(() => {
    console.log('Sorting products with sort option:', sortOption);
    
    // For 'recommended' sort, handle pinned products separately
    if (sortOption === 'recommended') {
      // Separate pinned and unpinned products
      const pinnedProducts = [];
      const unpinnedProducts = [];
      
      for (const product of filteredByCategory) {
        const hasPinOrder = product.pinOrder !== undefined && product.pinOrder !== null;
        const isValidPinOrder = hasPinOrder && Number(product.pinOrder) > 0;
        if (isValidPinOrder) {
          pinnedProducts.push(product);
        } else {
          unpinnedProducts.push(product);
        }
      }
      
      // Sort pinned products by their pin order
      pinnedProducts.sort((a, b) => Number(a.pinOrder) - Number(b.pinOrder));
      
      // Sort unpinned products by sales count and creation date
      unpinnedProducts.sort((a, b) => {
        const aOrderCount = a.publicOrderCount || 0;
        const bOrderCount = b.publicOrderCount || 0;
        const orderCountCompare = bOrderCount - aOrderCount;
        
        if (orderCountCompare === 0) {
          const salesCompare = (b.salesCount || 0) - (a.salesCount || 0);
          if (salesCompare === 0) {
            return b.id.localeCompare(a.id);
          }
          return salesCompare;
        }
        return orderCountCompare;
      });
      
      // Combine pinned and unpinned products
      return [...pinnedProducts, ...unpinnedProducts];
    }
    
    // For other sort options
    return [...filteredByCategory].sort((a, b) => {
      switch (sortOption) {
        case 'popular':
          const aOrderCount = a.publicOrderCount || 0;
          const bOrderCount = b.publicOrderCount || 0;
          if (aOrderCount === bOrderCount) {
            return (b.salesCount || 0) - (a.salesCount || 0);
          }
          return bOrderCount - aOrderCount;
        case 'newest':
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          return b.id.localeCompare(a.id);
        case 'price':
          return (a.price || 0) - (b.price || 0);
        default:
          return 0;
      }
    });
  }, [filteredByCategory, sortOption]);

  // Function to load more products (or initial load)
  const loadProducts = useCallback((reset = false, isPreloading = false) => {
    // Don't load if already loading or if there's nothing more to load
    if ((isLoadingRef.current && !isPreloading) || !sortedProducts.length) {
      console.log('Skipping load - Already loading or no products available');
      return;
    }

    if (isPreloading) {
      preloadingRef.current = true;
    }
    isLoadingRef.current = true;
    
    try {
      if (reset) {
        console.log('Resetting products');
        setLoading(true);
        offset.current = 0;
        setVisibleProducts([]); // Clear existing products first
        sessionStorage.removeItem(actualCacheKey);
      } else if (!isPreloading) {
        setLoadingMore(true);
      }
      
      const currentOffset = offset.current;
      const limit = reset ? initialLimit : loadMoreCount;
      
      // Get next batch of products
      const nextBatch = sortedProducts.slice(currentOffset, currentOffset + limit);
      const hasMoreProducts = currentOffset + limit < sortedProducts.length;
      
      console.log(`Loading products - Total: ${sortedProducts.length}, Current offset: ${currentOffset}, Batch size: ${nextBatch.length}, Has more: ${hasMoreProducts}`);
      
      if (isMounted.current) {
        setHasMore(hasMoreProducts);
        
        // Only update visible products if not preloading
        if (!isPreloading) {
          setVisibleProducts(prev => {
            const newProducts = reset ? nextBatch : [...prev, ...nextBatch];
            console.log(`Updated state - Visible products: ${newProducts.length}, Has more: ${hasMoreProducts}, Next offset: ${currentOffset + nextBatch.length}`);
            return newProducts;
          });
        }
        
        // Update offset after successful load
        offset.current = currentOffset + nextBatch.length;
        console.log(`Updating hasMore state - Offset: ${offset.current}, Total: ${sortedProducts.length}, Has more: ${hasMoreProducts}`);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      if (isMounted.current && !isPreloading) {
        setLoading(false);
        setLoadingMore(false);
      }
      isLoadingRef.current = false;
      if (isPreloading) {
        preloadingRef.current = false;
      }
    }
  }, [sortedProducts, initialLimit, loadMoreCount, actualCacheKey]);

  // Function to load more products
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore && !isLoadingRef.current) {
      console.log('Loading more products');
      loadProducts(false);
    }
  }, [loading, loadingMore, hasMore, loadProducts]);

  // Restore scroll listener for infinite scroll
  useEffect(() => {
    if (!hasMore || loadingMore || loading || !isMounted.current) return;

    let scrollTimeout: NodeJS.Timeout | null = null;
    let isScrolling = false;
    
    const handleScroll = () => {
      if (isLoadingRef.current || preloadingRef.current || isScrolling) return;

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      isScrolling = true;

      // Throttle scroll handling
      scrollTimeout = setTimeout(() => {
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const scrollPercentage = (scrollTop + windowHeight) / docHeight;

        if (scrollPercentage > 1 - preloadThreshold) {
          console.log('Loading more products from scroll');
          loadMore();
        }
        
        isScrolling = false;
      }, 150); // Increased throttle time for better performance
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [hasMore, loadingMore, loading, loadMore, preloadThreshold]);

  // Add a check for stuck state
  useEffect(() => {
    if (hasMore && !loading && !loadingMore && visibleProducts.length === 0 && sortedProducts.length > 0) {
      console.log('Detected stuck state - reloading products');
      loadProducts(true);
    }
  }, [hasMore, loading, loadingMore, visibleProducts.length, sortedProducts.length, loadProducts]);

  // Reset when category changes
  useEffect(() => {
    const categoryChanged = lastCategoryId.current !== categoryId;
    
    if (categoryChanged && initializedRef.current) {
      console.log(`Category changed from ${lastCategoryId.current} to ${categoryId}`);
      lastCategoryId.current = categoryId;
      loadProducts(true);
    } else if (!initializedRef.current && sortedProducts.length > 0) {
      console.log('Initial load of products');
      loadProducts(true);
    }
  }, [categoryId, loadProducts, sortedProducts.length]);

  // Function to explicitly reset products
  const resetProducts = useCallback(() => {
    console.log('Explicitly resetting products');
    loadProducts(true);
  }, [loadProducts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    products: visibleProducts,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    resetProducts
  };
} 