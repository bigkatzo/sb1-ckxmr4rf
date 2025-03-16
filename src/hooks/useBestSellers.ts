import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import { createCategoryIndicesFromProducts } from '../utils/category-mapping';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import type { Product } from '../types/index';

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
  category_eligibility_rules?: { groups: Array<{ operator: 'AND' | 'OR'; rules: Array<{ type: string; value: string }> }> };
  collection_id: string;
  collection_name: string;
  collection_slug: string;
  collection_launch_date: string;
  collection_sale_ended: boolean;
  slug: string;
  variants: any[];
  variant_prices: Record<string, number>;
  price_modifier_before_min?: number;
  price_modifier_after_min?: number;
  sales_count?: number;
}

export function useBestSellers(limit = 6, sortBy: 'sales' | 'popularity' = 'sales') {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryIndices, setCategoryIndices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchBestSellers() {
      const cacheKey = `bestsellers:${limit}:${sortBy}`;
      const { value: cachedData, needsRevalidation } = cacheManager.get<{
        products: Product[];
        categoryIndices: Record<string, number>;
      }>(cacheKey);
      
      // Use cached data if available
      if (cachedData) {
        if (isMounted) {
          setProducts(cachedData.products);
          setCategoryIndices(cachedData.categoryIndices);
          setLoading(false);
        }
        
        // If stale, revalidate in background
        if (needsRevalidation && !isFetchingRef.current) {
          revalidateBestSellers(cacheKey);
        }
        
        return;
      }
      
      // No cache hit, fetch fresh data
      if (isMounted) {
        setLoading(true);
      }
      
      try {
        await fetchFreshBestSellers(cacheKey);
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
    
    async function revalidateBestSellers(cacheKey: string) {
      if (isFetchingRef.current) return;
      
      isFetchingRef.current = true;
      cacheManager.markRevalidating(cacheKey);
      
      try {
        await fetchFreshBestSellers(cacheKey, false);
      } catch (err) {
        console.error('Error revalidating best sellers:', err);
      } finally {
        isFetchingRef.current = false;
        cacheManager.unmarkRevalidating(cacheKey);
      }
    }
    
    async function fetchFreshBestSellers(cacheKey: string, updateLoadingState = true) {
      try {
        if (updateLoadingState && isMounted) {
          setLoading(true);
        }
        
        const { data, error } = await supabase
          .rpc('get_best_sellers', { 
            p_limit: limit,
            p_sort_by: sortBy
          });

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
            visible: true,
            eligibilityRules: {
              groups: product.category_eligibility_rules?.groups || []
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
          variantPrices: product.variant_prices || {},
          priceModifierBeforeMin: product.price_modifier_before_min ?? null,
          priceModifierAfterMin: product.price_modifier_after_min ?? null,
          salesCount: product.sales_count || 0
        }));

        const indices = createCategoryIndicesFromProducts(transformedProducts);
        
        // Cache the results with SEMI_DYNAMIC durations
        cacheManager.set(
          cacheKey, 
          {
            products: transformedProducts,
            categoryIndices: indices
          }, 
          CACHE_DURATIONS.SEMI_DYNAMIC.TTL, 
          CACHE_DURATIONS.SEMI_DYNAMIC.STALE
        );

        if (isMounted) {
          setProducts(transformedProducts);
          setCategoryIndices(indices);
          setError(null);
          if (updateLoadingState) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error fetching best sellers:', err);
        if (isMounted && updateLoadingState) {
          setError(handleError(err));
          setProducts([]);
          setCategoryIndices({});
          setLoading(false);
        }
        throw err;
      }
    }

    fetchBestSellers();

    return () => {
      isMounted = false;
    };
  }, [limit, sortBy]);

  return { products, categoryIndices, loading, error };
}