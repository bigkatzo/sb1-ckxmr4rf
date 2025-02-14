import { useState, useEffect } from 'react';
import { supabase, withRetry } from '../lib/supabase';
import { createCategoryIndicesFromProducts } from '../utils/category-mapping';
import type { Product } from '../types';

export function useBestSellers(limit = 6) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryIndices, setCategoryIndices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchBestSellers() {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await withRetry(async () =>
          supabase
            .from('products')
            .select(`
              *,
              categories:category_id (
                id,
                name,
                description,
                type,
                eligibility_rules
              ),
              collections:collection_id (
                id,
                name,
                slug,
                launch_date,
                sale_ended
              )
            `)
            .order('created_at', { ascending: false })
            .limit(limit)
        );

        if (error) throw error;
        if (!isMounted) return;

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
          collectionLaunchDate: product.collections?.launch_date ? new Date(product.collections.launch_date) : undefined,
          collectionSaleEnded: product.collections?.sale_ended,
          slug: product.slug,
          stock: product.quantity || 0,
          variants: product.variants || [],
          variantPrices: product.variant_prices || {},
          variantStock: product.variant_stock || {}
        }));

        setProducts(transformedProducts);
        const indices = createCategoryIndicesFromProducts(transformedProducts);
        setCategoryIndices(indices);
        setError(null);
      } catch (err) {
        console.error('Error fetching best sellers:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch best sellers'));
          setProducts([]);
          setCategoryIndices({});
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchBestSellers();

    return () => {
      isMounted = false;
    };
  }, [limit]);

  return { products, categoryIndices, loading, error };
}