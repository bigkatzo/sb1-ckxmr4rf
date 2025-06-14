import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeStorageUrl } from '../lib/storage';
import type { Collection } from '../types';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';

interface PublicCollection {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  launch_date: string;
  featured: boolean;
  visible: boolean;
  sale_ended: boolean;
  slug: string;
  owner_merchant_tier?: string;
}

interface CollectionOptions {
  initialLimit?: number; // Initial number of items to load
  loadMoreCount?: number; // Number of items to load on "load more"
  infiniteScroll?: boolean; // Whether to enable infinite scrolling
}

// Debounce helper function
function debounce<T extends (...args: any[]) => void>(
  func: T, 
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function useCollections(
  filter: 'upcoming' | 'latest' | 'popular',
  options: CollectionOptions = {}
) {
  const {
    initialLimit = 6, // Default to 6 if not specified
    loadMoreCount = 6, // Load 6 more items at a time
    infiniteScroll = filter === 'latest' // Enable infinite scroll for latest by default
  } = options;

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offset = useRef(0); // Track current offset for pagination
  const isMounted = useRef(true); // Track component mounted state
  const isFirstLoad = useRef(true); // Track if this is the first load
  const isLoadingRef = useRef(false); // Track loading state to prevent concurrent requests
  
  // Reset state when filter changes
  useEffect(() => {
    setCollections([]);
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setHasMore(true);
    offset.current = 0;
    isFirstLoad.current = true;
    isLoadingRef.current = false;
  }, [filter]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchCollections = useCallback(async (reset = false) => {
    // CRITICAL: Emergency circuit breaker to prevent infinite fetch loops
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    try {
      if (reset) {
        setLoading(true);
        offset.current = 0;
      } else {
        setLoadingMore(true);
      }
      
      setError(null);
      
      // Calculate limit and offset
      const limit = reset || isFirstLoad.current ? initialLimit : loadMoreCount;
      const currentOffset = reset ? 0 : offset.current;

      // Add a small timeout for better UI experience on very fast connections
      if (!reset && infiniteScroll) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Use the appropriate function based on filter
      let queryData;
      
      if (filter === 'latest' && infiniteScroll) {
        // Use pagination parameters for latest collections
        const { data, error } = await supabase.rpc(
          'get_latest_collections',
          { 
            p_limit: limit,
            p_offset: currentOffset
          }
        );
        queryData = { data, error };
      } else {
        // Check cache for non-paginated collections
        const cacheKey = `collections:${filter}`;
        
        // Only try cache for initial loads 
        if (isFirstLoad.current && !reset) {
          try {
            const { value: cachedData, needsRevalidation } = await cacheManager.get<PublicCollection[]>(cacheKey);
            
            if (cachedData) {
              // Transform cached data
              const transformedCollections = cachedData.map((collection: PublicCollection) => ({
                id: collection.id,
                name: collection.name,
                description: collection.description,
                imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
                launchDate: new Date(collection.launch_date),
                featured: collection.featured,
                visible: collection.visible,
                saleEnded: collection.sale_ended,
                slug: collection.slug,
                ownerMerchantTier: collection.owner_merchant_tier as any,
                products: [],
                categories: []
              }));
              
              if (isMounted.current) {
                setCollections(transformedCollections);
                setLoading(false);
                setLoadingMore(false);
                isLoadingRef.current = false;
                
                // If cache is stale, revalidate in background
                if (needsRevalidation) {
                  setTimeout(() => {
                    fetchCollections(true);
                  }, 3000);  
                }
              }
              
              return;
            }
          } catch (err) {
            console.error('Cache error for collections:', err);
            // Continue with normal fetching on cache error 
          }
        }
        
        // Use original functions without pagination for other filters
        const { data, error } = await supabase.rpc(
          filter === 'upcoming' ? 'get_upcoming_collections' :
          filter === 'latest' ? 'get_latest_collections' :
          'get_latest_collections' // For 'popular', use latest and sort client-side
        );
        queryData = { data, error };
        
        // Cache non-paginated results for filter types
        if (!currentOffset && data && data.length > 0) {
          // Use SEMI_DYNAMIC duration for upcoming/popular
          const cacheDuration = filter === 'upcoming' ? 
            CACHE_DURATIONS.SEMI_DYNAMIC : 
            CACHE_DURATIONS.PRODUCT;
            
          cacheManager.set(
            cacheKey,
            data,
            cacheDuration.TTL,
            {
              staleTime: cacheDuration.STALE,
              priority: cacheDuration.PRIORITY
            }
          ).catch(err => {
            console.error('Error caching collections:', err);
          });
        }
      }
      
      if (!isMounted.current) {
        isLoadingRef.current = false;
        return;
      }
      
      const { data, error } = queryData;
      if (error) throw error;

      // Check if there's no more data to load
      if (!data || data.length === 0) {
        setHasMore(false);
        if (reset) setCollections([]);
        isLoadingRef.current = false;
        return;
      }

      const transformedCollections = data.map((collection: PublicCollection) => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
        launchDate: new Date(collection.launch_date),
        featured: collection.featured,
        visible: collection.visible,
        saleEnded: collection.sale_ended,
        slug: collection.slug,
        ownerMerchantTier: collection.owner_merchant_tier as any,
        products: [], // Products are loaded separately when needed
        categories: [] // Categories are loaded separately when needed
      }));

      // For 'popular' filter, sort by featured status
      if (filter === 'popular') {
        transformedCollections.sort((a: Collection, b: Collection) => {
          if (a.featured === b.featured) {
            return b.launchDate.getTime() - a.launchDate.getTime();
          }
          return b.featured ? 1 : -1;
        });
      }

      // If we got fewer items than requested, there are no more to load
      setHasMore(transformedCollections.length >= limit);

      // Update collections - either replace or append
      setCollections(prevCollections => 
        reset ? transformedCollections : [...prevCollections, ...transformedCollections]
      );
      
      // Update offset for next fetch
      offset.current = reset ? transformedCollections.length : offset.current + transformedCollections.length;
      
      // No longer first load
      isFirstLoad.current = false;

    } catch (err) {
      if (!isMounted.current) {
        isLoadingRef.current = false;
        return;
      }
      
      console.error('Error fetching collections:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      if (reset) setCollections([]);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setLoadingMore(false);
      }
      // CRITICAL: Reset the loading flag
      setTimeout(() => {
        isLoadingRef.current = false;
      }, 300); // Short cooldown to prevent rapid re-fetching
    }
  // FIXED: Remove loading, loadingMore, hasMore from dependency array to prevent infinite loop
  }, [filter, infiniteScroll, initialLimit, loadMoreCount]);

  // Load initial collections - with separate effect to prevent repeating
  useEffect(() => {
    let mounted = true;
    
    const initialLoad = async () => {
      if (mounted) {
        await fetchCollections(true);
      }
    };
    
    initialLoad();
    
    return () => {
      mounted = false;
    };
  // Only run this effect once on mount and when fetchCollections changes
  }, [fetchCollections]);

  // Function to load more collections
  const loadMore = useCallback(() => {
    // Add safety check to prevent duplicate loading
    if (!isLoadingRef.current && hasMore) {
      fetchCollections(false);
    }
  }, [hasMore, fetchCollections]);

  // Debounced version of loadMore for better scroll performance
  const debouncedLoadMore = useCallback(
    debounce(() => {
      if (hasMore && !loadingMore && !loading) {
        loadMore();
      }
    }, 150), // 150ms debounce
  [hasMore, loadingMore, loading, loadMore]);

  return { 
    collections, 
    loading, 
    loadingMore,
    error, 
    hasMore,
    refreshCollections: () => fetchCollections(true),
    loadMore: infiniteScroll ? debouncedLoadMore : loadMore
  };
}