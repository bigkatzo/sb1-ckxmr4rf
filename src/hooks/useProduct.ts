import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import type { Product } from '../types/index';

export function useProduct(collectionSlug?: string, productSlug?: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchProduct() {
      if (!collectionSlug || !productSlug) return;

      try {
        // First try to get from cache
        const cacheKey = `product:${collectionSlug}:${productSlug}`;
        const { value: cachedProduct, needsRevalidation } = await cacheManager.get<Product>(cacheKey);

        // Use cached data if available
        if (cachedProduct) {
          if (isMounted) {
            setProduct(cachedProduct);
            setLoading(false);
          }

          // If stale, revalidate in background
          if (needsRevalidation) {
            revalidateProduct();
          }
          return;
        }

        // No cache hit, fetch fresh data
        await fetchFreshProduct();
      } catch (err) {
        console.error('Error fetching product:', err);
        if (isMounted) {
          setError(handleError(err));
          setProduct(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    async function revalidateProduct() {
      try {
        await fetchFreshProduct(false);
      } catch (err) {
        console.error('Error revalidating product:', err);
      }
    }

    async function fetchFreshProduct(updateLoadingState = true) {
      if (!collectionSlug || !productSlug) return;

      try {
        if (updateLoadingState && isMounted) {
          setLoading(true);
        }

        const { data, error } = await supabase
          .from('public_products')
          .select('*')
          .eq('collection_slug', collectionSlug)
          .eq('slug', productSlug)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Product not found');
        
        // Fix for empty object in JSONB column
        const hasValidNotes = data.notes && typeof data.notes === 'object' && Object.keys(data.notes).length > 0;
        
        // CRITICAL FIX: Make sure free_notes is properly processed from database column name
        const freeNotesValue = data.free_notes !== null && data.free_notes !== undefined ? String(data.free_notes) : '';

        const transformedProduct: Product = {
          id: data.id,
          sku: data.sku,
          name: data.name,
          description: data.description,
          price: data.price,
          imageUrl: data.images?.[0] ? normalizeStorageUrl(data.images[0]) : '',
          images: (data.images || []).map((img: string) => normalizeStorageUrl(img)),
          designFiles: (data.design_files || []).map((file: string) => normalizeStorageUrl(file)),
          categoryId: data.category_id,
          collectionId: data.collection_id,
          collectionName: data.collection_name,
          collectionSlug: data.collection_slug,
          collectionLaunchDate: data.collection_launch_date ? new Date(data.collection_launch_date) : undefined,
          collectionSaleEnded: data.collection_sale_ended ?? false,
          categorySaleEnded: data.category_sale_ended ?? false,
          slug: data.slug || '',
          stock: data.quantity,
          minimumOrderQuantity: data.minimum_order_quantity || 50,
          variants: data.variants || [],
          variantPrices: data.variant_prices || {},
          priceModifierBeforeMin: data.price_modifier_before_min ?? null,
          priceModifierAfterMin: data.price_modifier_after_min ?? null,
          visible: data.visible ?? true,
          saleEnded: data.sale_ended ?? false,
          notes: hasValidNotes ? data.notes : undefined,
          freeNotes: freeNotesValue
        };

        // Cache the product data
        const cacheKey = `product:${collectionSlug}:${productSlug}`;
        await cacheManager.set(
          cacheKey, 
          transformedProduct, 
          CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
          {
            persist: true,
            priority: 1,
            staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
          }
        );

        if (isMounted) {
          setProduct(transformedProduct);
          setError(null);
          if (updateLoadingState) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error fetching fresh product:', err);
        if (isMounted && updateLoadingState) {
          setError(handleError(err));
          setProduct(null);
          setLoading(false);
        }
        throw err;
      }
    }

    fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [collectionSlug, productSlug]);

  return { product, loading, error };
}