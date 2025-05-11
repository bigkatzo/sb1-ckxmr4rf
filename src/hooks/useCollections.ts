import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeStorageUrl } from '../lib/storage';
import type { Collection } from '../types';

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
}

interface CollectionOptions {
  initialLimit?: number; // Initial number of items to load
  loadMoreCount?: number; // Number of items to load on "load more"
  infiniteScroll?: boolean; // Whether to enable infinite scrolling
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
  
  // Reset state when filter changes
  useEffect(() => {
    setCollections([]);
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setHasMore(true);
    offset.current = 0;
    isFirstLoad.current = true;
  }, [filter]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchCollections = useCallback(async (reset = false) => {
    // Don't fetch if already loading or if there's nothing more to load
    if ((loading || loadingMore) && !reset) return;
    if (!hasMore && !reset) return;
    
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
        // Use original functions without pagination for other filters
        const { data, error } = await supabase.rpc(
          filter === 'upcoming' ? 'get_upcoming_collections' :
          filter === 'latest' ? 'get_latest_collections' :
          'get_latest_collections' // For 'popular', use latest and sort client-side
        );
        queryData = { data, error };
      }
      
      if (!isMounted.current) return; // Don't update state if unmounted
      
      const { data, error } = queryData;
      if (error) throw error;
      
      // Check if there's no more data to load
      if (!data || data.length === 0) {
        setHasMore(false);
        if (reset) setCollections([]);
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
      if (!isMounted.current) return; // Don't update state if unmounted
      
      console.error('Error fetching collections:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      if (reset) setCollections([]);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [filter, infiniteScroll, initialLimit, loadMoreCount, loading, loadingMore, hasMore]);

  // Load initial collections
  useEffect(() => {
    fetchCollections(true);
  }, [fetchCollections]);

  // Function to load more collections
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      fetchCollections(false);
    }
  }, [loading, loadingMore, hasMore, fetchCollections]);

  return { 
    collections, 
    loading, 
    loadingMore,
    error, 
    hasMore,
    refreshCollections: () => fetchCollections(true),
    loadMore
  };
}