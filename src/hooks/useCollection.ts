import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleCollectionError } from '../utils/error-handlers';
import { isValidCollectionSlug } from '../utils/validation';
import { canPreviewHiddenContent, getPreviewAwareCacheKey } from '../utils/preview';
import type { Collection } from '../types/collections';
import { normalizeStorageUrl } from '../lib/storage';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';

export function useCollection(slug: string) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(!slug ? false : true); // Don't load if no slug
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    // Early return if no slug - avoid all the expensive cache and fetch logic
    if (!slug) {
      setCollection(null);
      setLoading(false);
      setError(null);
      return;
    }
    let isMounted = true;
    
    // Cache keys to listen for invalidation - use preview-aware keys
    const cacheKeys = [
      getPreviewAwareCacheKey(`collection:${slug}`),
      getPreviewAwareCacheKey(`collection_static:${slug}`),
      getPreviewAwareCacheKey(`collection_dynamic:${slug}`)
    ];
    
    // Function to handle cache invalidation
    const handleCacheInvalidation = (invalidatedKey: string) => {
      if (cacheKeys.some(key => invalidatedKey.includes(key) || key.includes(invalidatedKey))) {
        console.log('Collection cache invalidated, refetching...', invalidatedKey);
        // Refetch collection data when cache is invalidated
        if (isMounted && !isFetchingRef.current) {
          revalidateCollection();
        }
      }
    };
    
    // Listen for cache invalidation events
    cacheManager.on('invalidated', handleCacheInvalidation);
    
    async function fetchCollection() {
      if (!slug || !isValidCollectionSlug(slug)) {
        if (isMounted) {
          setError('Invalid collection URL');
          setLoading(false);
        }
        return;
      }

      try {
        // First try to get from cache - use preview-aware key
        const cacheKey = getPreviewAwareCacheKey(`collection:${slug}`);
        const { value: cachedCollection, needsRevalidation } = await cacheManager.get<Collection>(cacheKey);
        
        // Use cached data if available
        if (cachedCollection) {
          if (isMounted) {
            setCollection(cachedCollection);
            setLoading(false);
          }
          
          // If stale, revalidate in background
          if (needsRevalidation && !isFetchingRef.current) {
            revalidateCollection();
          }
          return;
        }
        
        // No cache hit, fetch fresh data
        if (isMounted) {
          setLoading(true);
        }
        
        await fetchFreshCollection();
      } catch (err) {
        console.error('Error fetching collection:', err);
        if (isMounted) {
          setError(handleCollectionError(err));
          setCollection(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    
    async function revalidateCollection() {
      if (isFetchingRef.current) return;
      
      isFetchingRef.current = true;
      
      try {
        await fetchFreshCollection(false);
      } catch (err) {
        console.error('Error revalidating collection:', err);
      } finally {
        isFetchingRef.current = false;
      }
    }
    
    async function fetchFreshCollection(updateLoadingState = true) {
      try {
        if (updateLoadingState && isMounted) {
          setLoading(true);
          setError(null);
        }

        // Check if preview mode is enabled
        const includeHidden = canPreviewHiddenContent();
        
        // Fetch collection - use full table in preview mode, public view otherwise
        const collectionTable = includeHidden ? 'collections' : 'public_collections';
        let collectionQuery = supabase
          .from(collectionTable)
          .select('*')
          .eq('slug', slug);
        
        // If using the full collections table in preview mode, don't filter by visibility
        // The public_collections view already filters by visibility
        
        console.log(`Fetching collection from ${collectionTable} with slug: ${slug} (includeHidden: ${includeHidden})`);
        
        const { data: collectionData, error: collectionError } = await collectionQuery.single();

        // If collection not found in public view but we're not in preview mode, 
        // it might be a hidden collection that the user is trying to access
        if (collectionError && !includeHidden && collectionError.code === 'PGRST116') {
          console.log('Collection not found in public view, this might be a hidden collection');
          throw new Error('Collection not found or not visible');
        }

        if (collectionError) throw collectionError;
        if (!collectionData) throw new Error('Collection not found');

        // Then fetch categories and products in parallel - use full tables in preview mode
        const categoriesTable = includeHidden ? 'categories' : 'public_categories';
        
        let productsQuery;
        if (includeHidden) {
          // When in preview mode, fetch from products table with joins
          productsQuery = supabase
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
                name,
                slug,
                launch_date,
                sale_ended
              )
            `)
            .eq('collection_id', collectionData.id);
        } else {
          // Use public view which already has flattened fields
          productsQuery = supabase
            .from('public_products_with_categories')
            .select('*')
            .eq('collection_id', collectionData.id);
        }
        
        const [categoriesResponse, productsResponse, orderCountsResponse] = await Promise.all([
          supabase
            .from(categoriesTable)
            .select('*')
            .eq('collection_id', collectionData.id),
          productsQuery,
          // Fetch order counts from public_order_counts
          supabase
            .from('public_order_counts')
            .select('product_id, total_orders')
            .eq('collection_id', collectionData.id)
        ]);

        if (categoriesResponse.error) throw categoriesResponse.error;
        if (productsResponse.error) throw productsResponse.error;
        
        // Create a map of product IDs to order counts
        const orderCountsMap = new Map();
        if (!orderCountsResponse.error && orderCountsResponse.data) {
          console.log('Public order counts data:', orderCountsResponse.data);
          orderCountsResponse.data.forEach(item => {
            orderCountsMap.set(item.product_id, item.total_orders);
          });
        } else {
          console.warn('Failed to fetch public order counts:', orderCountsResponse?.error);
        }

        // Transform collection data (static)
        const collectionStatic = {
          id: collectionData.id,
          name: collectionData.name,
          description: collectionData.description,
          imageUrl: collectionData.image_url ? normalizeStorageUrl(collectionData.image_url) : '',
          slug: collectionData.slug,
          categories: (categoriesResponse.data || []).map(category => ({
            id: category.id,
            name: category.name,
            description: category.description,
            type: category.type,
            visible: category.visible ?? true,
            eligibilityRules: {
              groups: category.eligibility_rules?.groups || []
            }
          })),
        };
        
        // Cache static collection data with long TTL - use preview-aware key
        await cacheManager.set(
          getPreviewAwareCacheKey(`collection_static:${collectionData.id}`), 
          collectionStatic, 
          CACHE_DURATIONS.STATIC.TTL,
          { staleTime: CACHE_DURATIONS.STATIC.STALE }
        );

        // Transform and cache products
        const products = await Promise.all((productsResponse.data || []).map(async product => {
          // Get public order count for this product
          const publicOrderCount = orderCountsMap.get(product.id) || 0;
          
          // Static product data
          const productStatic = {
            id: product.id,
            sku: product.sku,
            name: product.name,
            description: product.description,
            imageUrl: product.images?.[0] ? normalizeStorageUrl(product.images[0]) : '',
            images: (product.images || []).map((img: string) => normalizeStorageUrl(img)),
            categoryId: product.category_id,
            category: product.category_id ? {
              id: product.category_id,
              name: product.category_name || product.categories?.name,
              description: product.category_description || product.categories?.description,
              type: product.category_type || product.categories?.type,
              visible: product.categories?.visible ?? true,
              eligibilityRules: {
                groups: product.category_eligibility_rules?.groups || product.categories?.eligibility_rules?.groups || []
              }
            } : undefined,
            collectionId: product.collection_id,
            collectionName: product.collection_name || product.collections?.name,
            collectionSlug: product.collection_slug || product.collections?.slug,
            collectionCa: collectionData.ca || '',
            collectionStrictToken: collectionData.strict_token || '',
            slug: product.slug || '',
            variants: product.variants || [],
            baseCurrency: product.base_currency || 'sol',
            // Add created_at timestamp if available
            createdAt: product.created_at || null,
          };

          // Cache static product data - use preview-aware key
          await cacheManager.set(
            getPreviewAwareCacheKey(`product_static:${product.id}`), 
            productStatic, 
            CACHE_DURATIONS.STATIC.TTL,
            { staleTime: CACHE_DURATIONS.STATIC.STALE }
          );

          // Dynamic product data
          const productDynamic = {
            price: product.price,
            stock: product.quantity,
            minimumOrderQuantity: product.minimum_order_quantity || 50,
            variantPrices: product.variant_prices || {},
            priceModifierBeforeMin: product.price_modifier_before_min ?? null,
            priceModifierAfterMin: product.price_modifier_after_min ?? null
          };

          // Cache dynamic product data - use preview-aware key
          await cacheManager.set(
            getPreviewAwareCacheKey(`product_dynamic:${product.id}`), 
            productDynamic, 
            CACHE_DURATIONS.REALTIME.TTL,
            { staleTime: CACHE_DURATIONS.REALTIME.STALE }
          );

          // Return combined product
          return {
            ...productStatic,
            ...productDynamic,
            collectionLaunchDate: new Date(collectionData.launch_date || product.collections?.launch_date),
            collectionSaleEnded: collectionData.sale_ended ?? product.collections?.sale_ended ?? false,
            categorySaleEnded: product.category_sale_ended ?? product.categories?.sale_ended ?? false,
            saleEnded: product.sale_ended ?? false,
            collectionOwnerMerchantTier: collectionData.owner_merchant_tier as any,
            // Add public order count for accurate sorting
            publicOrderCount: publicOrderCount,
            // Add salesCount for backward compatibility
            salesCount: product.sales_count || 0,
            // Add other product fields
            pinOrder: product.pin_order || null,
            blankCode: product.blank_code || '',
            technique: product.technique || '',
            noteForSupplier: product.note_for_supplier || '',
          };
        }));

        // Dynamic collection data
        const collectionDynamic = {
          launchDate: new Date(collectionData.launch_date),
          featured: collectionData.featured,
          visible: collectionData.visible,
          saleEnded: collectionData.sale_ended,
        };

        // Cache dynamic collection data - use preview-aware key
        await cacheManager.set(
          getPreviewAwareCacheKey(`collection_dynamic:${collectionData.id}`), 
          collectionDynamic, 
          CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
          { staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE }
        );

        // Combine everything for the complete collection
        const transformedCollection: Collection = {
          id: collectionData.id,
          name: collectionData.name,
          description: collectionData.description,
          imageUrl: collectionData.image_url ? normalizeStorageUrl(collectionData.image_url) : '',
          launchDate: new Date(collectionData.launch_date),
          featured: collectionData.featured || false,
          visible: collectionData.visible ?? true,
          saleEnded: collectionData.sale_ended ?? false,
          slug: collectionData.slug,
          ownerMerchantTier: collectionData.owner_merchant_tier as any,
          user_id: collectionData.user_id || '',
          custom_url: collectionData.custom_url || '',
          x_url: collectionData.x_url || '',
          telegram_url: collectionData.telegram_url || '',
          dexscreener_url: collectionData.dexscreener_url || '',
          pumpfun_url: collectionData.pumpfun_url || '',
          website_url: collectionData.website_url || '',
          free_notes: collectionData.free_notes || '',
          // Add theme data
          theme_primary_color: collectionData.theme_primary_color,
          theme_secondary_color: collectionData.theme_secondary_color,
          theme_background_color: collectionData.theme_background_color,
          theme_text_color: collectionData.theme_text_color,
          theme_use_custom: collectionData.theme_use_custom ?? false,
          theme_use_classic: collectionData.theme_use_classic ?? true,
          theme_logo_url: collectionData.theme_logo_url,
          categories: (categoriesResponse.data || []).map(category => ({
            id: category.id,
            name: category.name,
            description: category.description,
            type: category.type,
            visible: category.visible ?? true,
            eligibilityRules: {
              groups: category.eligibility_rules?.groups || []
            }
          })),
          products,
          accessType: null,
          isOwner: false,
          owner_username: null
        };

        // Cache the complete collection - use preview-aware key
        await cacheManager.set(
          getPreviewAwareCacheKey(`collection:${slug}`), 
          transformedCollection, 
          CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
          { staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE }
        );

        if (isMounted) {
          setCollection(transformedCollection);
          setError(null);
          if (updateLoadingState) {
            setLoading(false);
          }
        }

        // After all products are transformed
        console.log('Transformed products with order counts:', products.map(p => ({
          id: p.id.substring(0, 6),
          name: p.name,
          publicOrderCount: p.publicOrderCount,
          salesCount: p.salesCount,
          pinOrder: p.pinOrder,
          createdAt: p.createdAt
        })));
      } catch (err) {
        console.error('Error fetching collection:', err);
        if (isMounted && updateLoadingState) {
          setError(handleCollectionError(err));
          setCollection(null);
          setLoading(false);
        }
        throw err;
      }
    }

    fetchCollection();
    
    return () => {
      isMounted = false;
      // Remove cache invalidation listener
      cacheManager.off('invalidated', handleCacheInvalidation);
    };
  }, [slug]);

  return { collection, loading, error };
}