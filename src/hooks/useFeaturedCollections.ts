import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeStorageUrl } from '../lib/storage';
import type { Collection } from '../types';

export function useFeaturedCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchFeaturedCollections() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .rpc('get_featured_collections');

        if (error) throw error;

        const transformedCollections = (data || []).map(collection => ({
          id: collection.id,
          name: collection.name,
          description: collection.description,
          imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
          launchDate: new Date(collection.launch_date),
          featured: collection.featured,
          visible: collection.visible,
          saleEnded: collection.sale_ended,
          slug: collection.slug
        }));

        if (isMounted) {
          setCollections(transformedCollections);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching featured collections:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch featured collections'));
          setCollections([]);
        }
      } finally {
        if (isMounted) {
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