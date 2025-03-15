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
      const { value: cachedStock, needsRevalidation } = cacheManager.get<number | null>(cacheKey);
      
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
          revalidateStock();
        }
        
        return;
      }
      
      // No cache hit, fetch fresh data
      await fetchFreshStock();
    }
    
    async function revalidateStock() {
      if (isFetchingRef.current) return;
      
      isFetchingRef.current = true;
      const cacheKey = `product_stock:${productId}`;
      cacheManager.markRevalidating(cacheKey);
      
      try {
        await fetchFreshStock(false);
      } catch (err) {
        console.error('Error revalidating product stock:', err);
      } finally {
        isFetchingRef.current = false;
        cacheManager.unmarkRevalidating(cacheKey);
      }
    }
    
    async function fetchFreshStock(updateLoadingState = true) {
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
        const cacheKey = `product_stock:${productId}`;
        
        // Very short TTL for stock data
        cacheManager.set(
          cacheKey, 
          currentStock, 
          CACHE_DURATIONS.REALTIME.TTL, 
          CACHE_DURATIONS.REALTIME.STALE
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
      }
    }
    
    fetchStock();
    
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
          if (mounted && payload.new?.quantity !== undefined) {
            // Update cache
            const cacheKey = `product_stock:${productId}`;
            cacheManager.set(
              cacheKey, 
              payload.new.quantity, 
              CACHE_DURATIONS.REALTIME.TTL, 
              CACHE_DURATIONS.REALTIME.STALE
            );
            
            // Update state
            setStockData({
              stock: payload.new.quantity,
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
  
  return stockData;
} 