import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleCollectionError } from '../utils/error-handlers';
import { isValidCollectionSlug } from '../utils/validation';
import type { Collection } from '../types/collections';
import { normalizeStorageUrl } from '../lib/storage';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';

export function useCollection(slug: string) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchCollection() {
      if (!slug || !isValidCollectionSlug(slug)) {
        if (isMounted) {
          setError('Invalid collection URL');
          setLoading(false);
        }
        return;
      }

      try {
        // First try to get from cache
        const cacheKey = `collection:${slug}`;
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

        // Fetch collection from public view
        const { data: collectionData, error: collectionError } = await supabase
          .from('public_collections')
          .select('*')
          .eq('slug', slug)
          .single();

        if (collectionError) throw collectionError;
        if (!collectionData) throw new Error('Collection not found');

        // Then fetch categories and products in parallel from public views
        const [categoriesResponse, productsResponse, orderCountsResponse] = await Promise.all([
          supabase
            .from('public_categories')
            .select('*')
            .eq('collection_id', collectionData.id),
          supabase
            .from('public_products_with_categories')
            .select('*')
            .eq('collection_id', collectionData.id),
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
        
        // Cache static collection data with long TTL
        await cacheManager.set(
          `collection_static:${collectionData.id}`, 
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
            slug: product.slug || '',
            variants: product.variants || [],
            // Add created_at timestamp if available
            createdAt: product.created_at || null,
          };

          // Cache static product data
          await cacheManager.set(
            `product_static:${product.id}`, 
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

          // Cache dynamic product data
          await cacheManager.set(
            `product_dynamic:${product.id}`, 
            productDynamic, 
            CACHE_DURATIONS.REALTIME.TTL,
            { staleTime: CACHE_DURATIONS.REALTIME.STALE }
          );

          // Return combined product
          return {
            ...productStatic,
            ...productDynamic,
            collectionLaunchDate: new Date(collectionData.launch_date),
            collectionSaleEnded: collectionData.sale_ended ?? false,
            categorySaleEnded: product.category_sale_ended ?? false,
            saleEnded: product.sale_ended ?? false,
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

        // Cache dynamic collection data
        await cacheManager.set(
          `collection_dynamic:${collectionData.id}`, 
          collectionDynamic, 
          CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
          { staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE }
        );

        // Combine everything for the complete collection
        const transformedCollection: Collection = {
          id: collectionData.id,
          name: collectionData.name,
          description: collectionData.description,
          image_url: collectionData.image_url || '',
          imageUrl: collectionData.image_url ? normalizeStorageUrl(collectionData.image_url) : '',
          launch_date: collectionData.launch_date,
          launchDate: new Date(collectionData.launch_date),
          featured: collectionData.featured || false,
          visible: collectionData.visible ?? true,
          sale_ended: collectionData.sale_ended ?? false,
          saleEnded: collectionData.sale_ended ?? false,
          slug: collectionData.slug,
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

        // Cache the complete collection
        await cacheManager.set(
          `collection:${slug}`, 
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
    };
  }, [slug]);

  return { collection, loading, error };
}