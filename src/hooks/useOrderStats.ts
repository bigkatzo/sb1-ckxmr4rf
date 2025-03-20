import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import { 
  subscribeToFilteredChanges
} from '../lib/realtime/subscriptions';

interface OrderStats {
  currentOrders: number;
  loading: boolean;
  error: string | null;
}

const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff delays
const DEBOUNCE_WAIT = 500; // 500ms debounce for real-time updates

// Throttle the number of active order subscriptions
// This limits the number of concurrent realtime subscriptions
const MAX_CONCURRENT_SUBSCRIPTIONS = 3; // Limit concurrent subscriptions

// Global subscription tracking
const activeSubscriptions = new Map<string, {
  cleanup: () => void,
  priority: number,
  lastAccessed: number
}>();

// Track which product IDs are currently using polling
const pollingProducts = new Set<string>();

// Get current active subscription count
function getActiveSubscriptionCount() {
  return activeSubscriptions.size;
}

// Prioritize which subscriptions to keep active
function prioritizeSubscriptions() {
  if (getActiveSubscriptionCount() <= MAX_CONCURRENT_SUBSCRIPTIONS) {
    return;
  }
  
  // Sort by priority and last accessed time
  const entries = Array.from(activeSubscriptions.entries())
    .sort((a, b) => {
      // First by priority (higher is better)
      if (b[1].priority !== a[1].priority) {
        return b[1].priority - a[1].priority;
      }
      // Then by last accessed (more recent is better)
      return b[1].lastAccessed - a[1].lastAccessed;
    });
  
  // Keep only MAX_CONCURRENT_SUBSCRIPTIONS active
  const toRemove = entries.slice(MAX_CONCURRENT_SUBSCRIPTIONS);
  
  // Convert removed subscriptions to polling
  toRemove.forEach(([productId, { cleanup }]) => {
    console.log(`Converting subscription to polling for ${productId}`);
    cleanup(); // Run cleanup function
    activeSubscriptions.delete(productId);
    pollingProducts.add(productId);
  });
}

export function useOrderStats(productId: string) {
  const [stats, setStats] = useState<OrderStats>({
    currentOrders: 0,
    loading: true,
    error: null
  });
  const isFetchingRef = useRef(false);
  const pollingIntervalRef = useRef<any>(null);
  const mountTimeRef = useRef<number>(Date.now());
  const priorityRef = useRef<number>(0);
  const cleanupFnsRef = useRef<Array<() => void>>([]);

  // Update last accessed time for this product
  const updateAccessTime = useCallback(() => {
    const subscription = activeSubscriptions.get(productId);
    if (subscription) {
      activeSubscriptions.set(productId, {
        ...subscription,
        lastAccessed: Date.now()
      });
    }
  }, [productId]);

  // Fetch order stats from the database
  const fetchOrderStats = useCallback(async (attempt = 0) => {
    updateAccessTime();
    
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
  }, [productId, updateAccessTime]);

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
    
    // Mark this product as using polling
    pollingProducts.add(productId);
    
    console.log(`Starting polling fallback for order stats for ${productId}`);
    pollingIntervalRef.current = setInterval(() => {
      fetchOrderStats();
    }, 30000); // Poll every 30 seconds
  }, [productId, fetchOrderStats]);

  // Setup subscriptions using shared channel approach
  const setupSubscriptions = useCallback(() => {
    console.log(`Setting up subscriptions for ${productId}`);
    
    // Clean up any existing subscriptions
    cleanupFnsRef.current.forEach(cleanup => cleanup());
    cleanupFnsRef.current = [];
    
    // Subscribe to order counts updates
    const orderCountsSubscription = subscribeToFilteredChanges(
      'public_order_counts',
      { product_id: productId },
      (payload: any) => {
        updateAccessTime();
        console.log('Order count update detected:', productId, payload);
        
        if (payload.new?.total_orders !== undefined) {
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
    
    // Keep track of cleanup functions
    cleanupFnsRef.current.push(orderCountsSubscription);
    
    // Setup monitoring for connection issues
    const setupConnectionMonitoring = () => {
      // Check connection status using Supabase's built-in method
      const checkHealth = () => {
        try {
          const channels = supabase.getChannels();
          const isHealthy = channels.length > 0 && 
            channels.some(channel => channel.state === 'joined');
          
          if (!isHealthy && !pollingProducts.has(productId)) {
            console.log(`Connection unhealthy for ${productId}, switching to polling`);
            startPolling();
          }
        } catch (err) {
          console.error('Error checking health:', err);
        }
      };
      
      // Initial check
      checkHealth();
      
      // Set up periodic check
      const healthCheckInterval = setInterval(checkHealth, 30000);
      
      // Cleanup function
      return () => clearInterval(healthCheckInterval);
    };
    
    const healthCheckCleanup = setupConnectionMonitoring();
    cleanupFnsRef.current.push(healthCheckCleanup);
    
    // Store overall cleanup function in activeSubscriptions
    const cleanup = () => {
      console.log(`Cleaning up subscriptions for ${productId}`);
      cleanupFnsRef.current.forEach(fn => fn());
      cleanupFnsRef.current = [];
      activeSubscriptions.delete(productId);
    };
    
    // Store in the global subscription registry
    activeSubscriptions.set(productId, {
      cleanup,
      priority: priorityRef.current,
      lastAccessed: Date.now()
    });
    
    // Clear from polling products if we've switched to subscription
    pollingProducts.delete(productId);
    
    return cleanup;
  }, [productId, debouncedFetch, updateAccessTime, startPolling]);

  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    
    // Set mount time for subscription priority
    mountTimeRef.current = Date.now();
    
    // Initial fetch
    fetchOrderStats();

    // Attempt to setup realtime or polling
    const setupConnection = () => {
      // Check if we should use polling
      const shouldUsePolling = 
        pollingProducts.has(productId) || // Already using polling
        getActiveSubscriptionCount() >= MAX_CONCURRENT_SUBSCRIPTIONS; // Too many subscriptions
      
      if (shouldUsePolling) {
        console.log(`Using polling for ${productId} (${getActiveSubscriptionCount()}/${MAX_CONCURRENT_SUBSCRIPTIONS} active subscriptions)`);
        startPolling();
      } else {
        // Use realtime subscription
        cleanupFn = setupSubscriptions();
        
        // After adding this subscription, check if we need to prioritize
        prioritizeSubscriptions();
      }
    };

    // Setup connection strategy
    setupConnection();

    // Return cleanup function
    return () => {
      // Remove from active subscriptions
      if (cleanupFn) {
        cleanupFn();
      }
      
      // Clear polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Remove from polling products
      pollingProducts.delete(productId);
      
      // Cancel any pending debounced fetches
      debouncedFetch.cancel();
    };
  }, [productId, fetchOrderStats, debouncedFetch, startPolling, setupSubscriptions]);

  return stats;
}