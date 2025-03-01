import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import { createCategoryIndicesFromProducts } from '../utils/category-mapping';
import type { Product } from '../types';

interface PublicProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  quantity: number;
  minimum_order_quantity: number;
  category_id: string;
  category_name?: string;
  category_description?: string;
  category_type?: string;
  category_eligibility_rules?: { rules: Array<{ type: string; value: string }> };
  collection_id: string;
  collection_name: string;
  collection_slug: string;
  collection_launch_date: string;
  collection_sale_ended: boolean;
  slug: string;
  variants: any[];
  variant_prices: Record<string, number>;
  variant_stock?: Record<string, number>;
}

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
          .rpc('get_best_sellers', { p_limit: limit });

        if (error) throw error;

        const transformedProducts = (data || []).map((product: PublicProduct) => ({
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          price: product.price,
          imageUrl: product.images?.[0] ? normalizeStorageUrl(product.images[0]) : '',
          images: (product.images || []).map((img: string) => normalizeStorageUrl(img)),
          categoryId: product.category_id,
          category: product.category_id ? {
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