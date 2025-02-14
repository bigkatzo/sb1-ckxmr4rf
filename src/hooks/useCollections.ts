import { useState, useEffect, useCallback } from 'react';
import { supabase, safeQuery } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import type { Collection } from '../types';

export function useCollections(filter: 'upcoming' | 'latest' | 'popular') {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();
      let query = supabase
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
        .eq('visible', true);

      // Apply filters
      if (filter === 'upcoming') {
        query = query.gt('launch_date', now);
      } else if (filter === 'latest') {
        query = query.lte('launch_date', now);
      }

      // Add ordering
      if (filter === 'popular') {
        query = query.order('featured', { ascending: false });
      }
      query = query.order('launch_date', { ascending: filter === 'upcoming' });

      const { data, error } = await safeQuery(() => 
        query.limit(12)
      );

      if (error) throw error;

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