import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface ProductPriceData {
  basePrice: number | null;
  variantPrices: Record<string, number> | null;
  priceModifierBeforeMin: number | null;
  priceModifierAfterMin: number | null;
  loading: boolean;
  error: string | null;
}

interface ProductPriceRecord {
  id: string;
  price: number;
  variant_prices: Record<string, number> | null;
  price_modifier_before_min: number | null;
  price_modifier_after_min: number | null;
}

function isPriceRecord(obj: any): obj is Partial<ProductPriceRecord> {
  return obj && (
    'price' in obj ||
    'variant_prices' in obj ||
    'price_modifier_before_min' in obj ||
    'price_modifier_after_min' in obj
  );
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
      
      try {
        // Updated to use async cache API
        const cacheResult = await cacheManager.get<Omit<ProductPriceData, 'loading' | 'error'>>(cacheKey);
        const cachedPrice = cacheResult.value;
        const needsRevalidation = cacheResult.needsRevalidation;
      
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
            await fetchFreshPrice(false);
          }
          
          return;
        }
      
        // No cache hit, fetch fresh data
        await fetchFreshPrice();
      } catch (err) {
        console.error('Cache error:', err);
        // If cache fails, try direct fetch
        await fetchFreshPrice();
      }
    }
    
    async function fetchFreshPrice(updateLoadingState = true) {
      if (isFetchingRef.current) return;
      
      isFetchingRef.current = true;
      
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
        
        // Very short TTL for price data - updated to use new signature
        await cacheManager.set(
          `product_price:${productId}`, 
          priceInfo, 
          CACHE_DURATIONS.REALTIME.TTL,
          { staleTime: CACHE_DURATIONS.REALTIME.STALE }
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
      } finally {
        isFetchingRef.current = false;
      }
    }
    
    // Run initial fetch
    fetchPrice().catch(err => {
      console.error('Initial price fetch error:', err);
    });
    
    // Set up realtime subscription for price updates
    const subscription = supabase.channel(`product_price_${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'public_products',
          filter: `id=eq.${productId}`
        },
        (payload: RealtimePostgresChangesPayload<ProductPriceRecord>) => {
          console.log(`Product price update received for ${productId}:`, payload);
          if (!mounted) return;
          
          const newData = isPriceRecord(payload.new) ? payload.new : {};
          const oldData = isPriceRecord(payload.old) ? payload.old : {};
          
          // Check if any price-related fields changed
          const priceChanged = 
            'price' in newData !== 'price' in oldData ||
            ('price' in newData && 'price' in oldData && newData.price !== oldData.price) ||
            JSON.stringify(newData.variant_prices) !== JSON.stringify(oldData.variant_prices) ||
            newData.price_modifier_before_min !== oldData.price_modifier_before_min ||
            newData.price_modifier_after_min !== oldData.price_modifier_after_min;

          if (priceChanged) {
            console.log('Price-related fields changed, updating state');
            const priceInfo: ProductPriceData = {
              loading: false,
              error: null,
              basePrice: newData?.price ?? null,
              variantPrices: newData?.variant_prices ?? null,
              priceModifierBeforeMin: newData?.price_modifier_before_min ?? null,
              priceModifierAfterMin: newData?.price_modifier_after_min ?? null,
            };
            
            // Update cache with new signature
            cacheManager.set(
              `product_price:${productId}`, 
              priceInfo, 
              CACHE_DURATIONS.REALTIME.TTL,
              { staleTime: CACHE_DURATIONS.REALTIME.STALE }
            ).catch(err => {
              console.error('Error updating price cache:', err);
            });
            
            // Update state
            setPriceData({
              ...priceInfo,
              loading: false,
              error: null
            });
          }
        }
      )
      .subscribe((status) => {
        console.log(`Price subscription status for ${productId}:`, status);
        if (status === 'CHANNEL_ERROR') {
          console.warn(`Price subscription error for ${productId}, will try to reconnect`);
        }
      });
      
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [productId]);
  
  return priceData;
} 