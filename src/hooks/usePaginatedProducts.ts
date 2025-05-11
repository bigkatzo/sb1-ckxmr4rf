import { useState, useEffect, useCallback, useRef } from 'react';
import type { Product } from '../types/variants';

interface PaginatedProductsOptions {
  initialLimit?: number; // Initial number of items to load
  loadMoreCount?: number; // Number of items to load on "load more"
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
  } = options;

  // Filter products by category if categoryId is provided
  const filteredAllProducts = useRef<Product[]>([]);
  
  // Update filtered products when dependencies change
  useEffect(() => {
    filteredAllProducts.current = categoryId 
      ? allProducts.filter(product => product.categoryId === categoryId)
      : allProducts;
  }, [allProducts, categoryId]);

  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offset = useRef(0); // Track current offset for pagination
  const isMounted = useRef(true); // Track component mounted state
  const isLoadingRef = useRef(false); // Track loading state to prevent concurrent operations
  const initializedRef = useRef(false); // Track if initial load has happened
  
  // Function to load more products (or initial load)
  const loadProducts = useCallback((reset = false) => {
    // Don't load if already loading or if there's nothing more to load
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    try {
      if (reset) {
        setLoading(true);
        offset.current = 0;
      } else {
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
        
        setVisibleProducts(prevProducts => 
          reset ? paginatedProducts : [...prevProducts, ...paginatedProducts]
        );
        
        // Update offset for next load
        offset.current = reset 
          ? Math.min(initialLimit, paginatedProducts.length)
          : offset.current + paginatedProducts.length;
        
        initializedRef.current = true;
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setLoadingMore(false);
      }
      isLoadingRef.current = false;
    }
  }, [initialLimit, loadMoreCount]);

  // Reset state when products or category changes but only during initial load
  useEffect(() => {
    const currentProducts = filteredAllProducts.current;
    
    // Check if current visible products exceeds what we'd expect based on offset
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
  }, [allProducts, categoryId, initialLimit, loadProducts]);

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