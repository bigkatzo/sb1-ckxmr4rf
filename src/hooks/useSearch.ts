import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SearchResult } from '../types';
import { debounce } from '../utils/debounce';

export function useSearch(query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const searchCollections = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('collections')
          .select('id, name, description, image_url, slug')
          .filter('visible', 'eq', true)
          .ilike('name', `%${searchQuery}%`)
          .limit(5);

        if (error) throw error;

        setResults(
          data.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description || '',
            imageUrl: item.image_url || '',
            slug: item.slug
          }))
        );
      } catch (error) {
        console.error('Error searching collections:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    setLoading(true);
    searchCollections(query);
  }, [query, searchCollections]);

  return { results, loading };
}