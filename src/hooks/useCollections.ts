import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import type { Collection, Category } from '../types';

export function useCollections(filter: 'upcoming' | 'latest' | 'popular') {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('collections')
        .select(`
          *,
          categories (
            id,
            name,
            description,
            type,
            eligibility_rules
          )
        `)
        .eq('visible', true);

      // Apply filter
      const now = new Date().toISOString();
      switch (filter) {
        case 'upcoming':
          query = query
            .gt('launch_date', now)
            .order('launch_date', { ascending: true });
          break;
        case 'latest':
          query = query
            .lte('launch_date', now)
            .order('launch_date', { ascending: false });
          break;
        case 'popular':
          query = query
            .lte('launch_date', now)
            .order('featured', { ascending: false })
            .order('launch_date', { ascending: false });
          break;
      }

      const { data, error } = await query;

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
        slug: collection.slug,
        categories: (collection.categories || []).map((category: any) => ({
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
      console.error('Error fetching collections:', err);
      setError(handleError(err));
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