import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';

interface ProductStockData {
  stock: number | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for tracking product stock in real-time
 * Uses a combination of caching and real-time subscriptions
 */
export function useProductStock(productId: string) {
  const [stockData, setStockData] = useState<ProductStockData>({
    stock: null,
    loading: true,
    error: null
  });
  const isFetchingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    
    // Initial fetch with caching
    async function fetchStock() {
      if (isFetchingRef.current) return;
      
      const cacheKey = `product_stock:${productId}`;
      
      try {
        // Updated to use async cache API
        const cacheResult = await cacheManager.get<number | null>(cacheKey);
        const cachedStock = cacheResult.value;
        const needsRevalidation = cacheResult.needsRevalidation;
      
        // Use cached data if available
        if (cachedStock !== null) {
          if (mounted) {
            setStockData({
              stock: cachedStock,
              loading: false,
              error: null
            });
          }
          
          // If stale, revalidate in background
          if (needsRevalidation && !isFetchingRef.current) {
            await fetchFreshStock(false);
          }
          
          return;
        }
      
        // No cache hit, fetch fresh data
        await fetchFreshStock();
      } catch (err) {
        console.error('Cache error:', err);
        // If cache fails, try direct fetch
        await fetchFreshStock();
      }
    }
    
    async function fetchFreshStock(updateLoadingState = true) {
      if (isFetchingRef.current) return;
      
      isFetchingRef.current = true;
      
      try {
        if (updateLoadingState && mounted) {
          setStockData(prev => ({
            ...prev,
            loading: true,
            error: null
          }));
        }
        
        const { data, error } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', productId)
          .single();
          
        if (error) throw error;
        
        const currentStock = data?.quantity;
        
        // Very short TTL for stock data - updated to use new signature
        await cacheManager.set(
          `product_stock:${productId}`, 
          currentStock, 
          CACHE_DURATIONS.REALTIME.TTL,
          { staleTime: CACHE_DURATIONS.REALTIME.STALE }
        );
        
        if (mounted) {
          setStockData({
            stock: currentStock,
            loading: false,
            error: null
          });
        }
      } catch (err) {
        console.error('Error fetching product stock:', err);
        if (mounted && updateLoadingState) {
          setStockData({
            stock: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to fetch stock'
          });
        }
      } finally {
        isFetchingRef.current = false;
      }
    }
    
    // Run initial fetch
    fetchStock().catch(err => {
      console.error('Initial stock fetch error:', err);
    });
    
    // Set up realtime subscription for stock updates
    const subscription = supabase.channel(`product_stock_${productId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `id=eq.${productId}`
        },
        (payload) => {
          console.log(`Product stock update received for ${productId}:`, payload);
          
          if (mounted && payload.new?.quantity !== undefined) {
            console.log('Stock quantity changed, updating state:', payload.new.quantity);
            
            // Update cache with new signature
            cacheManager.set(
              `product_stock:${productId}`, 
              payload.new.quantity, 
              CACHE_DURATIONS.REALTIME.TTL,
              { staleTime: CACHE_DURATIONS.REALTIME.STALE }
            ).catch(err => {
              console.error('Error updating stock cache:', err);
            });
            
            // Update state
            setStockData({
              stock: payload.new.quantity,
              loading: false,
              error: null
            });
          }
        }
      )
      .subscribe((status) => {
        console.log(`Stock subscription status for ${productId}:`, status);
        if (status === 'CHANNEL_ERROR') {
          console.warn(`Stock subscription error for ${productId}, will try to reconnect`);
        }
      });
      
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [productId]);
  
  return stockData;
} 