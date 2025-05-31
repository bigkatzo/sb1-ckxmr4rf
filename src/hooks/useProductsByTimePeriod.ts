import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import { createCategoryIndicesFromProducts } from '../utils/category-mapping';
import { cacheManager } from '../lib/cache';
import type { Product } from '../types/index';

export type TimePeriod = 'today' | 'last_7_days' | 'last_30_days' | 'all_time';
export type SortType = 'sales' | 'launch_date';

interface UseProductsByTimePeriodProps {
  initialLimit?: number;
  sortBy: SortType;
  timePeriod: TimePeriod;
  initialOffset?: number;
}

// Add SHORT cache duration if it doesn't exist
const SHORT_CACHE = {
  TTL: 5 * 60 * 1000, // 5 minutes
  STALE: 1 * 60 * 1000, // 1 minute
  PRIORITY: 5
};

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

  useEffect(() => {
    // Reset state when sort type or time period changes
    setProducts([]);
    setLoading(true);
    setHasMore(true);
    setOffset(initialOffset);
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
          setProducts(prevProducts => 
            offset > 0 ? [...prevProducts, ...cachedData.products] : cachedData.products
          );
          setCategoryIndices(cachedData.categoryIndices);
          setTotalCount(cachedData.totalCount);
          setHasMore(cachedData.products.length === limit);
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
        const { data, error } = await supabase
          .rpc(rpcName, { 
            p_limit: limit,
            p_offset: offset,
            ...(sortBy === 'sales' ? { p_time_period: timePeriod } : {})
          });

        if (error) throw error;
        
        // Debug the first product to see what data we're getting
        if (data && data.length > 0) {
          console.log('First product data:', data[0]);
        }

        // Get product IDs for count query
        const productIds = (data || []).map((p: any) => p.id);
        
        // Skip count query if no products returned
        let count = 0;
        if (productIds.length > 0) {
          // Get total count
          try {
            const countResult = await supabase
              .from('public_products_with_categories')
              .select('id', { count: 'exact', head: true });
            
            count = countResult.count || 0;
          } catch (countErr) {
            console.warn('Error getting product count:', countErr);
            // Continue without count
            count = productIds.length;
          }
        }

        const transformedProducts = (data || []).map((product: any) => {
          // Ensure free_notes is properly processed
          const freeNotesValue = product.free_notes !== null ? String(product.free_notes || '') : '';
          
          // Use order_count from the function result for proper sales display
          const salesCount = sortBy === 'sales' ? (product.order_count || 0) : (product.sales_count || 0);

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
            salesCount: salesCount,
            saleEnded: product.sale_ended || false,
            publicOrderCount: product.order_count,
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
        
        // Cache the results with short durations for time-sensitive data
        cacheManager.set(
          cacheKey, 
          {
            products: transformedProducts,
            categoryIndices: indices,
            totalCount: count || 0
          }, 
          SHORT_CACHE.TTL,
          {
            staleTime: SHORT_CACHE.STALE
          }
        );

        if (isMounted) {
          setProducts(prev => offset > 0 ? [...prev, ...transformedProducts] : transformedProducts);
          setCategoryIndices(indices);
          setTotalCount(count || 0);
          setHasMore(transformedProducts.length === limit);
          setError(null);
          if (updateLoadingState) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        if (isMounted && updateLoadingState) {
          setError(handleError(err));
          setProducts([]);
          setCategoryIndices({});
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
  }, [limit, sortBy, timePeriod, offset]);

  // Function to load more products
  const loadMore = () => {
    if (!loading && hasMore) {
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