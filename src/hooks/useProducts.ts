import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { handleError, isValidId } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import type { Product } from '../types';

export function useProducts(collectionId?: string, categoryId?: string, isMerchant: boolean = false) {
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
        .from(isMerchant ? 'merchant_products' : 'public_products_with_categories')
        .select('*')
        .eq('collection_id', collectionId)
        .order('id', { ascending: true });
      
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
        imageUrl: product.images?.[0] ? normalizeStorageUrl(product.images[0]) : '',
        images: (product.images || []).map((img: string) => normalizeStorageUrl(img)),
        categoryId: product.category_id,
        category: product.category_id && product.category_name ? {
          id: product.category_id,
          name: product.category_name,
          description: product.category_description,
          type: product.category_type,
          eligibilityRules: {
            rules: product.category_eligibility_rules?.rules || []
          }
        } : undefined,
        collectionId: product.collection_id,
        collectionName: product.collection_name,
        collectionSlug: product.collection_slug,
        collectionLaunchDate: product.collection_launch_date ? new Date(product.collection_launch_date) : undefined,
        collectionSaleEnded: product.collection_sale_ended,
        slug: product.slug || '',
        stock: product.quantity,
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
  }, [collectionId, categoryId, isMerchant]);

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