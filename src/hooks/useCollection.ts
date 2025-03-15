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

      const cacheKey = `collection:${slug}`;
      const { value: cachedCollection, needsRevalidation } = cacheManager.get<Collection>(cacheKey);
      
      // Use cached data if available
      if (cachedCollection) {
        if (isMounted) {
          setCollection(cachedCollection);
          setLoading(false);
        }
        
        // If stale, revalidate in background
        if (needsRevalidation && !isFetchingRef.current) {
          revalidateCollection(cacheKey);
        }
        
        return;
      }
      
      // No cache hit, fetch fresh data
      if (isMounted) {
        setLoading(true);
      }
      
      try {
        await fetchFreshCollection(cacheKey);
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
    
    async function revalidateCollection(cacheKey: string) {
      if (isFetchingRef.current) return;
      
      isFetchingRef.current = true;
      cacheManager.markRevalidating(cacheKey);
      
      try {
        await fetchFreshCollection(cacheKey, false);
      } catch (err) {
        console.error('Error revalidating collection:', err);
      } finally {
        isFetchingRef.current = false;
        cacheManager.unmarkRevalidating(cacheKey);
      }
    }
    
    async function fetchFreshCollection(cacheKey: string, updateLoadingState = true) {
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
        const [categoriesResponse, productsResponse] = await Promise.all([
          supabase
            .from('public_categories')
            .select('*')
            .eq('collection_id', collectionData.id),
          supabase
            .from('public_products_with_categories')
            .select('*')
            .eq('collection_id', collectionData.id)
        ]);

        if (categoriesResponse.error) throw categoriesResponse.error;
        if (productsResponse.error) throw productsResponse.error;

        // Transform collection data (static)
        const collectionStatic = {
          id: collectionData.id,
          name: collectionData.name,
          description: collectionData.description,
          image_url: collectionData.image_url || '',
          imageUrl: collectionData.image_url ? normalizeStorageUrl(collectionData.image_url) : '',
          slug: collectionData.slug,
          user_id: collectionData.user_id || '',
          isOwner: false,
          owner_username: null,
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
        cacheManager.set(
          `collection_static:${collectionData.id}`, 
          collectionStatic, 
          CACHE_DURATIONS.STATIC.TTL, 
          CACHE_DURATIONS.STATIC.STALE
        );
        
        // Transform products with separate static and dynamic data
        const products = (productsResponse.data || []).map(product => {
          // Static product data (doesn't change often)
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
            collectionId: collectionData.id,
            collectionName: collectionData.name,
            collectionSlug: collectionData.slug,
            slug: product.slug || '',
            variants: product.variants || [],
          };
          
          // Dynamic product data (changes frequently)
          const productDynamic = {
            price: product.price,
            stock: product.quantity,
            minimumOrderQuantity: product.minimum_order_quantity || 50,
            variantPrices: product.variant_prices || {},
            priceModifierBeforeMin: product.price_modifier_before_min ?? null,
            priceModifierAfterMin: product.price_modifier_after_min ?? null,
          };
          
          // Cache static product data with long TTL
          cacheManager.set(
            `product_static:${product.id}`, 
            productStatic, 
            CACHE_DURATIONS.STATIC.TTL, 
            CACHE_DURATIONS.STATIC.STALE
          );
          
          // Cache dynamic product data with short TTL
          cacheManager.set(
            `product_dynamic:${product.id}`, 
            productDynamic, 
            CACHE_DURATIONS.REALTIME.TTL, 
            CACHE_DURATIONS.REALTIME.STALE
          );
          
          // Return combined product
          return {
            ...productStatic,
            ...productDynamic,
            collectionLaunchDate: new Date(collectionData.launch_date),
            collectionSaleEnded: collectionData.sale_ended,
          };
        });
        
        // Dynamic collection data
        const collectionDynamic = {
          launch_date: collectionData.launch_date,
          launchDate: new Date(collectionData.launch_date),
          featured: collectionData.featured,
          visible: collectionData.visible,
          sale_ended: collectionData.sale_ended,
          saleEnded: collectionData.sale_ended,
          accessType: null // Public collections don't have access type
        };
        
        // Cache dynamic collection data with medium TTL
        cacheManager.set(
          `collection_dynamic:${collectionData.id}`, 
          collectionDynamic, 
          CACHE_DURATIONS.SEMI_DYNAMIC.TTL, 
          CACHE_DURATIONS.SEMI_DYNAMIC.STALE
        );

        // Combine everything for the complete collection
        const transformedCollection: Collection = {
          ...collectionStatic,
          ...collectionDynamic,
          products
        };

        // Cache the complete collection
        cacheManager.set(
          cacheKey, 
          transformedCollection, 
          CACHE_DURATIONS.SEMI_DYNAMIC.TTL, 
          CACHE_DURATIONS.SEMI_DYNAMIC.STALE
        );

        if (isMounted) {
          setCollection(transformedCollection);
          setError(null);
          if (updateLoadingState) {
            setLoading(false);
          }
        }
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