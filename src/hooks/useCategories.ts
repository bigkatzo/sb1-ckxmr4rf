import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { handleError, isValidId } from '../lib/error-handling';
import type { Category } from '../types/index';

export function useCategories(collectionId: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to fetch product counts for categories
  const fetchProductCounts = async (categoryIds: string[]) => {
    if (!categoryIds.length) return {};
    
    try {
      // Use the RPC function to get product counts by category
      const { data, error } = await supabase.rpc('get_product_counts_by_category', {
        category_ids: categoryIds
      });

      if (error) {
        console.error('Error calling get_product_counts_by_category:', error);
        
        // Fallback: initialize all counts to 0
        const productCountMap: Record<string, number> = {};
        categoryIds.forEach(id => {
          productCountMap[id] = 0;
        });
        return productCountMap;
      }

      // Create a map of category_id to count
      const productCountMap: Record<string, number> = {};
      if (Array.isArray(data)) {
        data.forEach((item: { category_id: string; count: number }) => {
          productCountMap[item.category_id] = item.count;
        });
      }

      return productCountMap;
    } catch (err) {
      console.error('Error fetching product counts for categories:', err);
      return {};
    }
  };

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
        .order('created_at', { ascending: true }); // Order by creation time instead of id

      if (error) throw error;
      
      if (!data || data.length === 0) {
        setCategories([]);
        setLoading(false);
        return;
      }

      // Extract category IDs for fetching product counts
      const categoryIds = data.map(c => c.id);
      
      // Fetch product counts for categories
      const productCountMap = await fetchProductCounts(categoryIds);
      
      const transformedCategories = data.map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        type: category.type,
        visible: category.visible,
        saleEnded: category.sale_ended ?? false,
        eligibilityRules: {
          groups: category.eligibility_rules?.groups || []
        },
        productCount: productCountMap[category.id] || 0
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