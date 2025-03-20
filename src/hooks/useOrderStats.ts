import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import { createRobustChannel } from '../lib/realtime/subscriptions';

interface OrderStats {
  currentOrders: number;
  loading: boolean;
  error: string | null;
}

const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff delays
const DEBOUNCE_WAIT = 500; // 500ms debounce for real-time updates

// Throttle the number of active order subscriptions
// This limits the number of concurrent realtime subscriptions
let ACTIVE_SUBSCRIPTIONS = 0;
const MAX_CONCURRENT_SUBSCRIPTIONS = 3; // Reduced from 5 to 3 to ensure stable connections

// Add global subscription queue
const subscriptionQueue: string[] = [];
let processingQueue = false;

// Process the next item in the subscription queue
async function processSubscriptionQueue() {
  if (processingQueue || subscriptionQueue.length === 0) return;
  
  processingQueue = true;
  
  // Wait until we have an available subscription slot
  while (ACTIVE_SUBSCRIPTIONS >= MAX_CONCURRENT_SUBSCRIPTIONS && subscriptionQueue.length > 0) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Process the next item if queue isn't empty
  if (subscriptionQueue.length > 0) {
    const productId = subscriptionQueue.shift();
    if (productId) {
      // This just marks that we've processed this ID - the actual subscription
      // will happen in the useOrderStats hook for this product
      console.log(`Processing subscription for ${productId} (${ACTIVE_SUBSCRIPTIONS}/${MAX_CONCURRENT_SUBSCRIPTIONS})`);
    }
  }
  
  processingQueue = false;
  
  // Continue processing if there are more items
  if (subscriptionQueue.length > 0) {
    processSubscriptionQueue();
  }
}

export function useOrderStats(productId: string) {
  const [stats, setStats] = useState<OrderStats>({
    currentOrders: 0,
    loading: true,
    error: null
  });
  const isFetchingRef = useRef(false);
  const pollingIntervalRef = useRef<any>(null);

  const fetchOrderStats = useCallback(async (attempt = 0) => {
    try {
      // Check cache first
      const cacheKey = `order_stats:${productId}`;
      
      // Updated to use async cache API
      const cacheResult = await cacheManager.get<number>(cacheKey);
      const cachedValue = cacheResult.value;
      const needsRevalidation = cacheResult.needsRevalidation;
      
      if (cachedValue !== null) {
        setStats({
          currentOrders: cachedValue,
          loading: false,
          error: null
        });
        
        // If stale, revalidate in background
        if (needsRevalidation && !isFetchingRef.current) {
          await fetchFreshOrderStats(false);
        }
        
        return;
      }

      // No cache hit, fetch fresh data
      await fetchFreshOrderStats();
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

  const fetchFreshOrderStats = useCallback(async (updateLoadingState = true) => {
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    
    try {
      if (updateLoadingState) {
        setStats(prev => ({
          ...prev,
          loading: true,
          error: null
        }));
      }
      
      const { data, error } = await supabase
        .from('public_order_counts')
        .select('total_orders')
        .eq('product_id', productId)
        .single();

      if (error) throw error;

      const orderCount = data?.total_orders || 0;

      // Update cache with REALTIME durations - new options format
      await cacheManager.set(
        `order_stats:${productId}`, 
        orderCount, 
        CACHE_DURATIONS.REALTIME.TTL,
        { staleTime: CACHE_DURATIONS.REALTIME.STALE }
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

  // Debounced version of fetchOrderStats for real-time updates
  const debouncedFetch = useCallback(
    debounce(() => {
      fetchOrderStats();
    }, DEBOUNCE_WAIT),
    [fetchOrderStats]
  );

  // Start polling as a fallback if realtime fails
  const startPolling = useCallback(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    console.log(`Starting polling fallback for order stats for ${productId}`);
    pollingIntervalRef.current = setInterval(() => {
      console.log(`Polling for order stats for ${productId}`);
      fetchOrderStats();
    }, 30000); // Poll every 30 seconds
  }, [productId, fetchOrderStats]);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;
    
    // Increment subscription counter when mounting
    ACTIVE_SUBSCRIPTIONS++;
    console.log(`Active subscriptions: ${ACTIVE_SUBSCRIPTIONS}/${MAX_CONCURRENT_SUBSCRIPTIONS}`);

    // Initial fetch
    if (mounted) {
      fetchOrderStats();
    }

    // Check if we have too many subscriptions
    if (ACTIVE_SUBSCRIPTIONS > MAX_CONCURRENT_SUBSCRIPTIONS) {
      console.log(`Too many active subscriptions (${ACTIVE_SUBSCRIPTIONS}/${MAX_CONCURRENT_SUBSCRIPTIONS}), using polling for ${productId}`);
      // Fall back to polling for this item
      startPolling();
    } else {
      // Set up realtime subscription with robust reconnection logic
      const setupSubscription = () => {
        console.log(`Setting up robust subscription for orders_${productId}`);
        
        // Create a robust channel for orders table
        const { channel, subscribe } = createRobustChannel(
          `orders_${productId}`,
          { broadcast: { self: true } },
          5 // Max reconnect attempts
        );
        
        // Listen for orders table changes
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `product_id=eq.${productId}`
          },
          (payload) => {
            console.log('Order change detected:', payload);
            if (mounted) {
              // For INSERT/DELETE use debounced fetch
              debouncedFetch();
            }
          }
        );
        
        // Listen for order counts view changes
        channel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'public_order_counts',
            filter: `product_id=eq.${productId}`
          },
          (payload) => {
            console.log('Order count update detected:', payload);
            if (mounted && payload.new?.total_orders !== undefined) {
              // Direct update from the order counts view
              const orderCount = payload.new.total_orders || 0;
              
              // Update cache with new options format
              cacheManager.set(
                `order_stats:${productId}`, 
                orderCount,
                CACHE_DURATIONS.REALTIME.TTL,
                { staleTime: CACHE_DURATIONS.REALTIME.STALE }
              ).catch(err => {
                console.error('Failed to update cache:', err);
              });
              
              // Update state directly
              setStats({
                currentOrders: orderCount,
                loading: false,
                error: null
              });
            }
          }
        );
        
        // Subscribe with connection status callback
        const subscription = subscribe((status) => {
          if (status.status === 'MAX_RETRIES_EXCEEDED') {
            console.warn(`Max retries exceeded for ${productId}, falling back to polling`);
            startPolling();
          }
        });
        
        // Create the cleanup function
        cleanup = () => {
          console.log(`Cleaning up subscription for orders_${productId}`);
          subscription.unsubscribe();
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
        };
      };

      setupSubscription();
    }

    // Return cleanup function
    return () => {
      mounted = false;
      if (cleanup) {
        cleanup();
      }
      
      // Decrement subscription counter when unmounting
      ACTIVE_SUBSCRIPTIONS--;
      console.log(`Active subscriptions after cleanup: ${ACTIVE_SUBSCRIPTIONS}/${MAX_CONCURRENT_SUBSCRIPTIONS}`);
      
      // Process queue after cleanup in case we now have room for another subscription
      processSubscriptionQueue();
      
      // Cancel any pending debounced fetches
      debouncedFetch.cancel();
    };
  }, [productId, fetchOrderStats, debouncedFetch, startPolling]);

  return stats;
}