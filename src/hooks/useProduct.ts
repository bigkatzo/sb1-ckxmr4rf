import { useState, useEffect } from 'react';
import { useSupabaseWithWallet } from './useSupabaseWithWallet';
import { handleError } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import { canPreviewHiddenContent } from '../utils/preview';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import type { Product } from '../types/index';
import { isValidStrictToken } from '../utils/strictTokenValidation';

export function useProduct(collectionSlug?: string, productSlug?: string, includeHiddenForDesign?: boolean) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use the authenticated Supabase client
  const { client: supabase, isAuthenticated, diagnostics } = useSupabaseWithWallet({ allowMissingToken: true });

  useEffect(() => {
    let isMounted = true;
    
    // Check if preview mode is enabled (needs to be in the outer scope)
    const includeHidden = canPreviewHiddenContent();

    async function fetchProduct() {
      if (!collectionSlug || !productSlug) return;

      // Check if we have a client (even if not fully authenticated)
      if (!supabase) {
        console.log('Waiting for Supabase client...', diagnostics);
        return;
      }

      try {
        // First try to get from cache
        const cacheKey = `product:${collectionSlug}:${productSlug}${includeHidden ? ':preview' : ''}`;
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

      // Check if we have a client
      if (!supabase) {
        console.log('Cannot fetch product: no Supabase client', diagnostics);
        return;
      }

      try {
        if (updateLoadingState && isMounted) {
          setLoading(true);
        }

        // Check if preview mode is enabled OR if we're on a design page
        const includeHidden = canPreviewHiddenContent() || includeHiddenForDesign;
        
        console.log(`Fetching product with preview mode: ${includeHidden}, collection: ${collectionSlug}, product: ${productSlug}, authenticated: ${isAuthenticated}`);
        
        let productQuery;
        if (includeHidden) {
          // When in preview mode or design page, fetch from products table with joins
          productQuery = supabase
            .from('products')
            .select(`
              *,
              categories:category_id (
                id,
                name,
                description,
                type,
                eligibility_rules,
                visible,
                sale_ended
              ),
              collections:collection_id (
                id,
                name,
                slug,
                launch_date,
                sale_ended,
                visible,
                user_id,
                recommended_ca,
              )
            `)
            .eq('slug', productSlug)
            .eq('collections.slug', collectionSlug);
        } else {
          // Use public_products_with_categories view which includes collection_owner_merchant_tier
          productQuery = supabase
          .from('public_products_with_categories')
          .select('*')
          .eq('collection_slug', collectionSlug)
            .eq('slug', productSlug);
        }
        
        const { data, error } = await productQuery.single();

        console.log('Fetched product data:', data);

        if (error) throw error;
        if (!data) throw new Error('Product not found');
        
        // Fix for empty object in JSONB column
        const hasValidNotes = data.notes && typeof data.notes === 'object' && Object.keys(data.notes).length > 0;
        
        // CRITICAL FIX: Make sure free_notes is properly processed from database column name
        const freeNotesValue = data.free_notes !== null && data.free_notes !== undefined ? String(data.free_notes) : '';

        // Extract merchant tier from different query structures
        let collectionOwnerMerchantTier;
        if (includeHidden) {
          // In preview mode, we need to fetch merchant tier separately from user_profiles
          // For now, let's set it to null and fetch it later if needed
          collectionOwnerMerchantTier = null;
          
          // If we have a collection user_id, fetch the merchant tier
          if (data.collections?.user_id) {
            try {
              const { data: userProfile } = await supabase
                .from('user_profiles')
                .select('merchant_tier')
                .eq('id', data.collections.user_id)
                .single();
              
              collectionOwnerMerchantTier = userProfile?.merchant_tier || null;
            } catch (err) {
              console.warn('Could not fetch merchant tier:', err);
              collectionOwnerMerchantTier = null;
            }
          }
        } else {
          // In normal mode, it comes directly from the view
          collectionOwnerMerchantTier = data.collection_owner_merchant_tier;
        }

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
          collectionName: data.collection_name || data.collections?.name,
          collectionSlug: data.collection_slug || data.collections?.slug,
          collectionLaunchDate: data.collection_launch_date ? new Date(data.collection_launch_date) : (data.collections?.launch_date ? new Date(data.collections.launch_date) : undefined),
          collectionSaleEnded: data.collection_sale_ended ?? data.collections?.sale_ended ?? false,
          categorySaleEnded: data.category_sale_ended ?? data.categories?.sale_ended ?? false,
          collectionCa: data.collection_ca ?? data.collections?.ca,
          collectionStrictToken: isValidStrictToken(data.collection_strict_token ?? data.collections?.strict_token) 
            ? (data.collection_strict_token ?? data.collections?.strict_token) 
            : '',
          slug: data.slug || '',
          stock: data.quantity,
          minimumOrderQuantity: data.minimum_order_quantity || 50,
          variants: data.variants || [],
          variantPrices: data.variant_prices || {},
          priceModifierBeforeMin: data.price_modifier_before_min ?? null,
          priceModifierAfterMin: data.price_modifier_after_min ?? null,
          pinOrder: data.pin_order ?? null,
          blankCode: data.blank_code || '',
          technique: data.technique || '',
          noteForSupplier: data.note_for_supplier || '',
          visible: data.visible ?? true,
          saleEnded: data.sale_ended ?? false,
          notes: hasValidNotes ? data.notes : undefined,
          collectionUserId: data.collection_user_id,
          collectionOwnerMerchantTier: collectionOwnerMerchantTier,
          freeNotes: freeNotesValue,
          isCustomizable: data.is_customizable ?? "no",
          customization: data.customization || {},
          baseCurrency: data.base_currency || 'SOL',
        };

        // Cache the product data with preview mode awareness
        const cacheKey = `product:${collectionSlug}:${productSlug}${includeHidden ? ':preview' : ''}`;
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
  }, [collectionSlug, productSlug, includeHiddenForDesign, supabase, isAuthenticated, diagnostics]);

  return { product, loading, error };
}