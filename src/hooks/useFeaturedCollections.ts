import { useState, useEffect } from 'react';
import { supabase, withRetry } from '../lib/supabase';
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
        setError(null);

        const { data, error } = await withRetry(async () => 
          supabase
            .from('collections')
            .select(`
              id,
              name,
              description,
              image_url,
              launch_date,
              featured,
              visible,
              sale_ended,
              slug,
              categories (
                id,
                name,
                description,
                type,
                eligibility_rules
              )
            `)
            .eq('featured', true)
            .eq('visible', true)
            .order('launch_date', { ascending: true })
            .limit(1)
        );

        if (error) throw error;
        if (!isMounted) return;

        const transformedCollections = (data || []).map(collection => ({
          id: collection.id,
          name: collection.name,
          description: collection.description,
          imageUrl: collection.image_url,
          launchDate: new Date(collection.launch_date),
          featured: collection.featured,
          visible: collection.visible,
          saleEnded: collection.sale_ended,
          slug: collection.slug,
          categories: (collection.categories || []).map(category => ({
            id: category.id,
            name: category.name,
            description: category.description,
            type: category.type,
            eligibilityRules: {
              rules: category.eligibility_rules?.rules || []
            }
          })),
          products: []
        }));

        setCollections(transformedCollections);
        setError(null);
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