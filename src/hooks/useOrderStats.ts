import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';

interface OrderStats {
  currentOrders: number;
  loading: boolean;
  error: string | null;
}

const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff delays
const CACHE_DURATION = 5000; // 5 seconds cache
const DEBOUNCE_WAIT = 500; // 500ms debounce for real-time updates

// In-memory cache
const statsCache = new Map<string, { value: number; timestamp: number }>();

export function useOrderStats(productId: string) {
  const [stats, setStats] = useState<OrderStats>({
    currentOrders: 0,
    loading: true,
    error: null
  });

  const fetchOrderStats = useCallback(async (attempt = 0) => {
    try {
      // Check cache first
      const cached = statsCache.get(productId);
      const now = Date.now();
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        setStats({
          currentOrders: cached.value,
          loading: false,
          error: null
        });
        return;
      }

      const { data, error } = await supabase
        .from('public_order_counts')
        .select('total_orders')
        .eq('product_id', productId)
        .single();

      if (error) throw error;

      const orderCount = data?.total_orders || 0;

      // Update cache
      statsCache.set(productId, {
        value: orderCount,
        timestamp: now
      });

      setStats({
        currentOrders: orderCount,
        loading: false,
        error: null
      });
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