import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeStorageUrl } from '../lib/storage';
import type { Collection } from '../types';
import { handleError } from '../lib/error-handling';

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

export function useCollections(filter: 'upcoming' | 'latest' | 'popular') {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the appropriate function based on filter
      const { data, error } = await supabase.rpc(
        filter === 'upcoming' ? 'get_upcoming_collections' :
        filter === 'latest' ? 'get_latest_collections' :
        'get_latest_collections' // For 'popular', use latest and sort client-side
      );

      if (error) throw error;

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

      setCollections(transformedCollections);
      setError(null);
    } catch (err) {
      console.error('Error fetching collections:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  return { collections, loading, error, refreshCollections: fetchCollections };
}