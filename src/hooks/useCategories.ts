import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleError, isValidId } from '../lib/error-handling';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import type { Category } from '../types/index';

// Cache key for categories
const getCategoriesCacheKey = (collectionId: string) => `merchant_categories:${collectionId}`;

export function useCategories(collectionId: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

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

  const fetchCategories = useCallback(async (isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    if (!isRefresh) {
      setError(null);
      setLoading(true);
    }
    
    setCategories([]);

    if (!collectionId) {
      setLoading(false);
      isFetchingRef.current = false;
      return;
    }

    if (!isValidId(collectionId)) {
      setError('Invalid collection identifier');
      setLoading(false);
      isFetchingRef.current = false;
      return;
    }

    // Cache key for this collection's categories
    const cacheKey = getCategoriesCacheKey(collectionId);

    try {
      // Check cache first if not explicitly refreshing
      if (!isRefresh) {
        const { value: cachedCategories, needsRevalidation } = await cacheManager.get<Category[]>(cacheKey);
        
        if (cachedCategories) {
          if (isMountedRef.current) {
            setCategories(cachedCategories);
            setLoading(false);
          }
          
          // If data is still fresh, return early
          if (!needsRevalidation) {
            isFetchingRef.current = false;
            return;
          }
          // Otherwise continue with the fetch in the background
        }
      }
      
      const { data, error } = await supabase
        .from('categories')
        .select('*, eligibility_rules')
        .eq('collection_id', collectionId)
        .order('created_at', { ascending: true }); // Order by creation time instead of id

      if (error) throw error;
      
      if (!data || data.length === 0) {
        if (isMountedRef.current) {
          setCategories([]);
          setLoading(false);
        }
        
        // Cache empty result too
        await cacheManager.set(
          cacheKey,
          [],
          CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
          { staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE }
        );
        
        isFetchingRef.current = false;
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

      if (isMountedRef.current) {
        setCategories(transformedCategories);
        setLoading(false);
      }
      
      // Cache the transformed categories
      await cacheManager.set(
        cacheKey,
        transformedCategories,
        CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
        { staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE }
      );
      
    } catch (err) {
      console.error('Error fetching categories:', err);
      if (isMountedRef.current) {
        setError(handleError(err));
        setLoading(false);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [collectionId]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchCategories(false);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchCategories]);

  const refreshCategories = useCallback(() => fetchCategories(true), [fetchCategories]);

  return { categories, loading, error, refreshCategories };
}