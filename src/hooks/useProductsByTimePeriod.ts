import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import { createCategoryIndicesFromProducts } from '../utils/category-mapping';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import type { Product } from '../types/index';

export type TimePeriod = 'today' | 'last_7_days' | 'last_30_days' | 'all_time';

// Get the appropriate cache duration based on sort type
function getCacheDuration(sortBy: SortType) {
  if (sortBy === 'sales') {
    return {
      TTL: CACHE_DURATIONS.REALTIME.TTL, // Short TTL for sales data
      STALE: CACHE_DURATIONS.REALTIME.STALE // Very short stale time
    };
  } else {
    return {
      TTL: CACHE_DURATIONS.NEW_PRODUCTS.TTL, // Medium TTL for launch date
      STALE: CACHE_DURATIONS.PRODUCT_LISTING.STALE // Short stale time
    };
  }
}

export type SortType = 'sales' | 'launch_date';

interface UseProductsByTimePeriodProps {
  initialLimit?: number;
  sortBy: SortType;
  timePeriod: TimePeriod;
  initialOffset?: number;
}

export function useProductsByTimePeriod({
  initialLimit = 50,
  sortBy = 'sales',
  timePeriod = 'all_time',
  initialOffset = 0
}: UseProductsByTimePeriodProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryIndices, setCategoryIndices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(initialOffset);
  const [limit] = useState(initialLimit);
  const isFetchingRef = useRef(false);
  const totalFetchedRef = useRef(0); // Keep track of total fetched products
  const emptyResultsCounter = useRef(0); // Track consecutive empty results
  const maxEmptyResults = 2; // Stop after 2 consecutive empty results

  useEffect(() => {
    // Reset state when sort type or time period changes
    setProducts([]);
    setLoading(true);
    setHasMore(true);
    setOffset(initialOffset);
    totalFetchedRef.current = 0; // Reset total fetched
    emptyResultsCounter.current = 0; // Reset empty results counter
  }, [sortBy, timePeriod, initialOffset]);

  useEffect(() => {
    let isMounted = true;

    async function fetchProducts() {
      const cacheKey = `products:${sortBy}:${timePeriod}:${limit}:${offset}`;
      const { value: cachedData, needsRevalidation } = await cacheManager.get<{
        products: Product[];
        categoryIndices: Record<string, number>;
        totalCount: number;
      }>(cacheKey);
      
      // Use cached data if available
      if (cachedData) {
        if (isMounted) {
          const newProducts = offset > 0 ? [...products, ...cachedData.products] : cachedData.products;
          setProducts(newProducts);
          setCategoryIndices(cachedData.categoryIndices);
          setTotalCount(cachedData.totalCount);
          
          // Update totalFetchedRef to track total fetched products
          totalFetchedRef.current = newProducts.length;
          
          // Calculate hasMore based on actual count and fetched products
          // Stop pagination if we received fewer items than requested
          if (cachedData.products.length < limit) {
            setHasMore(false);
            emptyResultsCounter.current = maxEmptyResults; // Force stop
          } else {
            setHasMore(totalFetchedRef.current < cachedData.totalCount);
          }
          
          setLoading(false);
        }
        
        // If stale, revalidate in background
        if (needsRevalidation && !isFetchingRef.current) {
          revalidateProducts(cacheKey);
        }
        
        return;
      }
      
      // No cache hit, fetch fresh data
      if (isMounted) {
        setLoading(true);
      }
      
      try {
        await fetchFreshProducts(cacheKey);
      } catch (err) {
        console.error('Error fetching products:', err);
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
    
    async function revalidateProducts(cacheKey: string) {
      if (isFetchingRef.current) return;
      
      isFetchingRef.current = true;
      
      try {
        await fetchFreshProducts(cacheKey, false);
      } catch (err) {
        console.error('Error revalidating products:', err);
      } finally {
        isFetchingRef.current = false;
      }
    }
    
    async function fetchFreshProducts(cacheKey: string, updateLoadingState = true) {
      try {
        if (updateLoadingState && isMounted) {
          setLoading(true);
        }
        
        // Construct the RPC call based on sort type
        let rpcName = sortBy === 'sales' 
          ? 'get_trending_products'
          : 'get_products_by_launch_date';
        
        console.log('Fetching products with:', { rpcName, sortBy, timePeriod, limit, offset });
        
        // Use proper query structure for Supabase RPC calls
        const { data, error, count } = await supabase
          .rpc(rpcName, { 
            p_limit: limit,
            p_offset: offset,
            ...(sortBy === 'sales' ? { p_time_period: timePeriod } : {})
          }, { count: 'exact' });

        if (error) throw error;
        
        // Early return if no data
        if (!data || data.length === 0) {
          if (isMounted) {
            // Increment empty results counter
            emptyResultsCounter.current += 1;
            
            // If we've seen multiple empty results, stop pagination
            if (emptyResultsCounter.current >= maxEmptyResults) {
              setHasMore(false);
            }
            
            if (offset === 0) {
              setProducts([]);
              setCategoryIndices({});
              setTotalCount(0);
            }
          }
          return;
        }
        
        // Reset empty results counter since we got data
        emptyResultsCounter.current = 0;

        const transformedProducts = data.map((product: any) => {
          // Ensure free_notes is properly processed
          const freeNotesValue = product.free_notes !== null ? String(product.free_notes || '') : '';
          
          // Both tabs now get order_count from public_trending_products
          const orderCount = product.order_count || 0;

          return {
            id: product.id,
            sku: product.sku || '',
            name: product.name,
            description: product.description,
            price: product.price,
            imageUrl: product.images?.[0] ? normalizeStorageUrl(product.images[0]) : '',
            images: (product.images || []).map((img: string) => normalizeStorageUrl(img)),
            designFiles: (product.design_files || []).map((file: string) => normalizeStorageUrl(file)),
            categoryId: product.category_id,
            category: product.category_id ? {
              id: product.category_id,
              name: product.category_name,
              description: product.category_description,
              type: product.category_type,
              visible: true,
              saleEnded: product.category_sale_ended || false,
              eligibilityRules: {
                groups: product.category_eligibility_rules?.groups || []
              }
            } : undefined,
            collectionId: product.collection_id,
            collectionName: product.collection_name,
            collectionSlug: product.collection_slug,
            collectionLaunchDate: product.collection_launch_date ? new Date(product.collection_launch_date) : undefined,
            collectionSaleEnded: product.collection_sale_ended,
            categorySaleEnded: product.category_sale_ended,
            slug: product.slug || '',
            stock: product.quantity,
            minimumOrderQuantity: product.minimum_order_quantity || 50,
            variants: product.variants || [],
            variantPrices: product.variant_prices || {},
            priceModifierBeforeMin: product.price_modifier_before_min ?? null,
            priceModifierAfterMin: product.price_modifier_after_min ?? null,
            salesCount: orderCount,
            saleEnded: product.sale_ended || false,
            publicOrderCount: orderCount,
            rank: product.rank,
            pinOrder: product.pin_order,
            blankCode: product.blank_code,
            technique: product.technique,
            noteForSupplier: product.note_for_supplier,
            notes: {
              shipping: product.shipping_notes || '',
              quality: product.quality_notes || '',
              returns: product.returns_notes || ''
            },
            freeNotes: freeNotesValue
          } as Product;
        });

        const indices = createCategoryIndicesFromProducts(transformedProducts);
        
        // Get a count of products if we didn't get it from the query
        let finalCount = count ?? 0;
        
        // If no count from the query, try to get it from the specific query based on sortBy
        if (!finalCount) {
          try {
            const countQuery = sortBy === 'sales'
              ? supabase.rpc('count_trending_products', { p_time_period: timePeriod })
              : supabase.rpc('count_products_by_launch_date');
              
            const { data: countData, error: countError } = await countQuery;
            
            if (!countError && countData) {
              finalCount = countData;
            } else {
              // Fallback count calculation - be conservative to avoid over-fetching
              finalCount = offset + transformedProducts.length + (transformedProducts.length === limit ? 50 : 0);
            }
          } catch (countErr) {
            console.warn('Error getting product count:', countErr);
            // Fallback: more conservative estimate
            finalCount = offset + transformedProducts.length + (transformedProducts.length === limit ? 50 : 0);
          }
        }
        
        // Cache the results with short durations for time-sensitive data
        cacheManager.set(
          cacheKey, 
          {
            products: transformedProducts,
            categoryIndices: indices,
            totalCount: finalCount
          }, 
          getCacheDuration(sortBy).TTL,
          {
            staleTime: getCacheDuration(sortBy).STALE
          }
        );

        if (isMounted) {
          const newProducts = offset > 0 ? [...products, ...transformedProducts] : transformedProducts;
          setProducts(newProducts);
          setCategoryIndices(indices);
          setTotalCount(finalCount);
          
          // Update total fetched count
          totalFetchedRef.current = newProducts.length;
          
          // Stop pagination if we received fewer items than requested
          if (transformedProducts.length < limit) {
            setHasMore(false);
          } else {
            // Determine if we have more products to fetch:
            // 1. Received a full page (limit) of results
            // 2. AND total fetched is less than total count 
            // 3. AND we haven't yet fetched more than a reasonable amount (failsafe)
            const maxReasonableProducts = 5000; // Set a reasonable limit to prevent excessive loading
            setHasMore(
              transformedProducts.length === limit && 
              totalFetchedRef.current < finalCount &&
              totalFetchedRef.current < maxReasonableProducts
            );
          }
          
          setError(null);
          if (updateLoadingState) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        if (isMounted && updateLoadingState) {
          setError(handleError(err));
          if (offset === 0) {
            setProducts([]);
            setCategoryIndices({});
          }
          setTotalCount(0);
          setHasMore(false);
          setLoading(false);
        }
        throw err;
      }
    }

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, [limit, sortBy, timePeriod, offset, products]);

  // Function to load more products
  const loadMore = () => {
    if (!loading && hasMore && emptyResultsCounter.current < maxEmptyResults) {
      setOffset(currentOffset => currentOffset + limit);
    }
  };

  return { 
    products, 
    categoryIndices, 
    loading, 
    error, 
    hasMore, 
    totalCount,
    loadMore
  };
} 