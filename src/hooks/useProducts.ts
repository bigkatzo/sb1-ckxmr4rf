import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { handleError, isValidId } from '../lib/error-handling';
import type { Product } from '../types';

export function useProducts(collectionId?: string, categoryId?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setError(null);
    setProducts([]);

    if (!collectionId) {
      setLoading(false);
      return;
    }

    if (!isValidId(collectionId) || (categoryId && !isValidId(categoryId))) {
      setError('Invalid identifier format');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let query = supabase
        .from('products')
        .select(`
          *,
          categories:category_id (*),
          collections:collection_id (
            id,
            name,
            slug
          )
        `)
        .eq('collection_id', collectionId)
        .order('id', { ascending: true }); // Add explicit ordering by primary key
      
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const transformedProducts = (data || []).map(product => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrl: product.images?.[0] || '',
        images: product.images || [],
        categoryId: product.category_id,
        category: product.categories ? {
          id: product.categories.id,
          name: product.categories.name,
          description: product.categories.description,
          type: product.categories.type,
          eligibilityRules: {
            rules: product.categories.eligibility_rules?.rules || []
          }
        } : undefined,
        collectionId: product.collection_id,
        collectionName: product.collections?.name,
        collectionSlug: product.collections?.slug,
        slug: product.slug || '',
        stock: product.quantity || 0,
        minimumOrderQuantity: product.minimum_order_quantity || 50,
        variants: product.variants || [],
        variantPrices: product.variant_prices || {}
      }));

      setProducts(transformedProducts);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(handleError(err));
    } finally {
      setLoading(false);
    }
  }, [collectionId, categoryId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { 
    products, 
    loading, 
    error,
    refreshProducts: fetchProducts
  };
}