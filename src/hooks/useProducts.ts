import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import type { Product } from '../types/variants';

// Get Supabase URL and key from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type ProductFilters = {
  categoryId?: string;
  collectionId?: string;
};

export const useProducts = (filters: ProductFilters = {}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { categoryId, collectionId } = filters;

  const fetchProducts = useCallback(async (skipCache = false) => {
    if (!supabase || (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
      setError('Supabase configuration is missing');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cacheKey = `products_${categoryId || 'all'}_${collectionId || 'all'}`;
      
      if (!skipCache) {
        const cachedData = cacheManager.get<Product[]>(cacheKey);
        if (cachedData) {
          setProducts(cachedData);
          setLoading(false);
          return;
        }
      }

      let query = supabase.from('merchant_products').select('*');

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      if (collectionId) {
        query = query.eq('collection_id', collectionId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const fetchedProducts = data || [];
      setProducts(fetchedProducts);
      cacheManager.set(cacheKey, fetchedProducts, CACHE_DURATIONS.PRODUCT_LISTING.TTL);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [categoryId, collectionId, SUPABASE_URL, SUPABASE_ANON_KEY]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const refreshProducts = useCallback(() => fetchProducts(true), [fetchProducts]);

  return { 
    products, 
    loading, 
    error,
    refreshProducts
  };
};