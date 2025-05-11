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
  const page = useRef(0); // Track current page for pagination

  const fetchCollections = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        page.current = 0;
      } else {
        setLoadingMore(true);
      }
      
      setError(null);
      
      // If resetting, start fresh, otherwise keep existing collections
      const offset = reset ? 0 : collections.length;
      const limit = reset ? initialLimit : loadMoreCount;
      
      // Use the appropriate function based on filter
      // Add pagination parameters for 'latest' when infinite scroll is enabled
      let queryData;
      
      if (filter === 'latest' && infiniteScroll) {
        // Use pagination parameters for latest collections
        const { data, error } = await supabase.rpc(
          'get_latest_collections',
          { 
            p_limit: limit,
            p_offset: offset
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
      
      const { data, error } = queryData;
      if (error) throw error;
      
      // Check if there's no more data to load
      if (!data || data.length === 0) {
        setHasMore(false);
        if (reset) setCollections([]);
        return;
      }

      const transformedCollections = (data || []).map((collection: PublicCollection) => ({
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
      if (transformedCollections.length < limit) {
        setHasMore(false);
      }

      // Update collections - either replace or append
      setCollections(prevCollections => 
        reset ? transformedCollections : [...prevCollections, ...transformedCollections]
      );
      
      // Increment page for next fetch
      page.current += 1;

    } catch (err) {
      console.error('Error fetching collections:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      if (reset) setCollections([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [collections.length, filter, infiniteScroll, initialLimit, loadMoreCount]);

  // Function to load more collections
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      fetchCollections(false);
    }
  }, [loading, loadingMore, hasMore, fetchCollections]);

  // Reset and fetch collections when filter changes
  useEffect(() => {
    fetchCollections(true);
  }, [filter, fetchCollections]);

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