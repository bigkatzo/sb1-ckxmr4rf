import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';

interface ProductPriceData {
  basePrice: number | null;
  variantPrices: Record<string, number> | null;
  priceModifierBeforeMin: number | null;
  priceModifierAfterMin: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for tracking product pricing in real-time
 * Uses a combination of caching and real-time subscriptions
 */
export function useProductPrice(productId: string) {
  const [priceData, setPriceData] = useState<ProductPriceData>({
    basePrice: null,
    variantPrices: null,
    priceModifierBeforeMin: null,
    priceModifierAfterMin: null,
    loading: true,
    error: null
  });
  const isFetchingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    
    // Initial fetch with caching
    async function fetchPrice() {
      if (isFetchingRef.current) return;
      
      const cacheKey = `product_price:${productId}`;
      const { value: cachedPrice, needsRevalidation } = cacheManager.get<Omit<ProductPriceData, 'loading' | 'error'>>(cacheKey);
      
      // Use cached data if available
      if (cachedPrice !== null) {
        if (mounted) {
          setPriceData({
            ...cachedPrice,
            loading: false,
            error: null
          });
        }
        
        // If stale, revalidate in background
        if (needsRevalidation && !isFetchingRef.current) {
          revalidatePrice();
        }
        
        return;
      }
      
      // No cache hit, fetch fresh data
      await fetchFreshPrice();
    }
    
    async function revalidatePrice() {
      if (isFetchingRef.current) return;
      
      isFetchingRef.current = true;
      const cacheKey = `product_price:${productId}`;
      cacheManager.markRevalidating(cacheKey);
      
      try {
        await fetchFreshPrice(false);
      } catch (err) {
        console.error('Error revalidating product price:', err);
      } finally {
        isFetchingRef.current = false;
        cacheManager.unmarkRevalidating(cacheKey);
      }
    }
    
    async function fetchFreshPrice(updateLoadingState = true) {
      try {
        if (updateLoadingState && mounted) {
          setPriceData(prev => ({
            ...prev,
            loading: true,
            error: null
          }));
        }
        
        const { data, error } = await supabase
          .from('products')
          .select('price, variant_prices, price_modifier_before_min, price_modifier_after_min')
          .eq('id', productId)
          .single();
          
        if (error) throw error;
        
        const priceInfo = {
          basePrice: data?.price || null,
          variantPrices: data?.variant_prices || null,
          priceModifierBeforeMin: data?.price_modifier_before_min || null,
          priceModifierAfterMin: data?.price_modifier_after_min || null,
        };
        
        const cacheKey = `product_price:${productId}`;
        
        // Very short TTL for price data
        cacheManager.set(
          cacheKey, 
          priceInfo, 
          CACHE_DURATIONS.REALTIME.TTL, 
          CACHE_DURATIONS.REALTIME.STALE
        );
        
        if (mounted) {
          setPriceData({
            ...priceInfo,
            loading: false,
            error: null
          });
        }
      } catch (err) {
        console.error('Error fetching product price:', err);
        if (mounted && updateLoadingState) {
          setPriceData(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to fetch price'
          }));
        }
      }
    }
    
    fetchPrice();
    
    // Set up realtime subscription for price updates
    const subscription = supabase.channel(`product_price_${productId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `id=eq.${productId}`
        },
        (payload) => {
          if (!mounted) return;
          
          // Check if any price-related fields changed
          const priceChanged = 
            payload.new?.price !== payload.old?.price ||
            JSON.stringify(payload.new?.variant_prices) !== JSON.stringify(payload.old?.variant_prices) ||
            payload.new?.price_modifier_before_min !== payload.old?.price_modifier_before_min ||
            payload.new?.price_modifier_after_min !== payload.old?.price_modifier_after_min;
            
          if (priceChanged) {
            const priceInfo = {
              basePrice: payload.new?.price || null,
              variantPrices: payload.new?.variant_prices || null,
              priceModifierBeforeMin: payload.new?.price_modifier_before_min || null,
              priceModifierAfterMin: payload.new?.price_modifier_after_min || null,
            };
            
            // Update cache
            const cacheKey = `product_price:${productId}`;
            cacheManager.set(
              cacheKey, 
              priceInfo, 
              CACHE_DURATIONS.REALTIME.TTL, 
              CACHE_DURATIONS.REALTIME.STALE
            );
            
            // Update state
            setPriceData({
              ...priceInfo,
              loading: false,
              error: null
            });
          }
        }
      )
      .subscribe();
      
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [productId]);
  
  return priceData;
} 