import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';

interface OrderStats {
  currentOrders: number;
  loading: boolean;
  error: string | null;
}

const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff delays
const DEBOUNCE_WAIT = 500; // 500ms debounce for real-time updates

export function useOrderStats(productId: string) {
  const [stats, setStats] = useState<OrderStats>({
    currentOrders: 0,
    loading: true,
    error: null
  });
  const isFetchingRef = useRef(false);

  const fetchOrderStats = useCallback(async (attempt = 0) => {
    try {
      // Check cache first
      const cacheKey = `order_stats:${productId}`;
      const { value: cachedValue, needsRevalidation } = cacheManager.get<number>(cacheKey);
      
      if (cachedValue !== null) {
        setStats({
          currentOrders: cachedValue,
          loading: false,
          error: null
        });
        
        // If stale, revalidate in background
        if (needsRevalidation && !isFetchingRef.current) {
          revalidateOrderStats(attempt);
        }
        
        return;
      }

      // No cache hit, fetch fresh data
      await fetchFreshOrderStats(attempt);
    } catch (err) {
      console.error('Error fetching order stats:', err);
      
      // Retry with exponential backoff
      if (attempt < RETRY_DELAYS.length) {
        setTimeout(() => {
          fetchOrderStats(attempt + 1);
        }, RETRY_DELAYS[attempt]);
      } else {
        // If all retries failed, show error but keep last known value
        setStats(prev => ({
          ...prev,
          loading: false,
          error: 'Unable to update order count'
        }));
        
        // Show toast only on final retry
        toast.error('Unable to update order count. Using cached data.', {
          toastId: `order-stats-error-${productId}`,
          autoClose: 3000
        });
      }
    }
  }, [productId]);

  const fetchFreshOrderStats = useCallback(async (attempt = 0) => {
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    const cacheKey = `order_stats:${productId}`;
    
    try {
      setStats(prev => ({
        ...prev,
        loading: true,
        error: null
      }));
      
      const { data, error } = await supabase
        .from('public_order_counts')
        .select('total_orders')
        .eq('product_id', productId)
        .single();

      if (error) throw error;

      const orderCount = data?.total_orders || 0;

      // Update cache with REALTIME durations
      cacheManager.set(
        cacheKey, 
        orderCount, 
        CACHE_DURATIONS.REALTIME.TTL, 
        CACHE_DURATIONS.REALTIME.STALE
      );

      setStats({
        currentOrders: orderCount,
        loading: false,
        error: null
      });
    } catch (err) {
      throw err; // Let the parent function handle retries
    } finally {
      isFetchingRef.current = false;
    }
  }, [productId]);

  const revalidateOrderStats = useCallback((attempt = 0) => {
    if (isFetchingRef.current) return;
    
    const cacheKey = `order_stats:${productId}`;
    cacheManager.markRevalidating(cacheKey);
    
    fetchFreshOrderStats(attempt)
      .catch(err => {
        console.error('Error revalidating order stats:', err);
      })
      .finally(() => {
        cacheManager.unmarkRevalidating(cacheKey);
      });
  }, [productId, fetchFreshOrderStats]);

  // Debounced version of fetchOrderStats for real-time updates
  const debouncedFetch = useCallback(
    debounce(() => {
      fetchOrderStats();
    }, DEBOUNCE_WAIT),
    [fetchOrderStats]
  );

  useEffect(() => {
    let mounted = true;
    let subscription: ReturnType<typeof supabase.channel> | null = null;

    // Initial fetch
    if (mounted) {
      fetchOrderStats();
    }

    // Set up realtime subscription with reconnection logic
    const setupSubscription = () => {
      subscription = supabase.channel(`orders_${productId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `product_id=eq.${productId}`
          },
          () => {
            if (mounted) {
              // Use debounced fetch for real-time updates
              debouncedFetch();
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            // Attempt to reconnect after a delay
            setTimeout(setupSubscription, 2000);
          }
        });
    };

    setupSubscription();

    // Cleanup
    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
      // Cancel any pending debounced fetches
      debouncedFetch.cancel();
    };
  }, [productId, fetchOrderStats, debouncedFetch]);

  return stats;
}