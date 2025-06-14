import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeStorageUrl } from '../lib/storage';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import type { Collection } from '../types';

type DbCollection = {
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
};

export function useFeaturedCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchFeaturedCollections() {
      try {
        // Check cache first
        const cacheKey = 'featured_collections';
        const { value: cachedCollections, needsRevalidation } = await cacheManager.get<Collection[]>(cacheKey);

        // Use cached data if available
        if (cachedCollections) {
          setCollections(cachedCollections);
          setLoading(false);
          
          // If the cache is stale, revalidate in the background
          if (needsRevalidation) {
            revalidateFeaturedCollections(cacheKey);
          }
          return;
        }

        // No cache hit, fetch fresh data
        await fetchFreshCollections(cacheKey);
      } catch (err) {
        console.error('Cache error:', err);
        // If cache fails, try direct fetch
        await fetchFreshCollections();
      }
    }

    async function revalidateFeaturedCollections(cacheKey: string) {
      if (!isMounted) return;
      
      try {
        await fetchFreshCollections(cacheKey, false);
      } catch (err) {
        console.error('Error revalidating featured collections:', err);
      }
    }

    async function fetchFreshCollections(cacheKey?: string, updateLoadingState = true) {
      if (!isMounted) return;
      
      try {
        if (updateLoadingState) {
          setLoading(true);
        }

        const { data, error } = await supabase.rpc('get_featured_collections');

        if (error) throw error;

        const transformedCollections = (data || []).map((collection: DbCollection) => ({
          id: collection.id,
          name: collection.name,
          description: collection.description,
          imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
          launchDate: new Date(collection.launch_date),
          featured: collection.featured,
          visible: collection.visible,
          saleEnded: collection.sale_ended,
          slug: collection.slug,
          ownerMerchantTier: collection.owner_merchant_tier as any
        }));

        if (isMounted) {
          setCollections(transformedCollections);
          setError(null);

          // Cache the results with SEMI_DYNAMIC durations
          if (cacheKey) {
            cacheManager.set(
              cacheKey,
              transformedCollections,
              CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
              {
                staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE,
                priority: CACHE_DURATIONS.SEMI_DYNAMIC.PRIORITY
              }
            );
          }
        }
      } catch (err) {
        console.error('Error fetching featured collections:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch featured collections'));
          setCollections([]);
        }
      } finally {
        if (isMounted && updateLoadingState) {
          setLoading(false);
        }
      }
    }

    fetchFeaturedCollections();

    return () => {
      isMounted = false;
    };
  }, []);

  return { collections, loading, error };
}