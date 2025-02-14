import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { handleError, isValidId } from '../lib/error-handling';
import type { Category } from '../types';

export function useCategories(collectionId: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setError(null);
    setCategories([]);

    if (!collectionId) {
      setLoading(false);
      return;
    }

    if (!isValidId(collectionId)) {
      setError('Invalid collection identifier');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('categories')
        .select('*, eligibility_rules')
        .eq('collection_id', collectionId)
        .order('id', { ascending: true }); // Add explicit ordering by primary key

      if (error) throw error;
      
      const transformedCategories = (data || []).map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        type: category.type,
        eligibilityRules: {
          rules: category.eligibility_rules?.rules || []
        }
      }));

      setCategories(transformedCategories);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError(handleError(err));
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, error, refreshCategories: fetchCategories };
}