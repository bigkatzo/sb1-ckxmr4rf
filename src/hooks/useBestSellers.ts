import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import { createCategoryIndicesFromProducts } from '../utils/category-mapping';
import type { Product } from '../types';

export function useBestSellers(limit = 6) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryIndices, setCategoryIndices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchBestSellers() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            categories:category_id (*),
            collections:collection_id (
              id,
              name,
              slug,
              launch_date,
              sale_ended
            )
          `)
          .order('quantity', { ascending: false })
          .limit(limit);

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
          minimumOrderQuantity: product.minimum_order_quantity || 50,
          variants: product.variants || [],
          variantPrices: product.variant_prices || {},
          variantStock: product.variant_stock || {}
        }));

        if (isMounted) {
          setProducts(transformedProducts);
          const indices = createCategoryIndicesFromProducts(transformedProducts);
          setCategoryIndices(indices);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching best sellers:', err);
        if (isMounted) {
          setError(handleError(err));
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