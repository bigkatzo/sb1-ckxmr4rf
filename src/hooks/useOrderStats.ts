import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import { RealtimeChannel } from '@supabase/supabase-js';

interface OrderStats {
  currentOrders: number;
  loading: boolean;
  error: string | null;
}

const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff delays
const DEBOUNCE_WAIT = 500; // 500ms debounce for real-time updates

// Priority levels for subscriptions
const SUBSCRIPTION_PRIORITY = {
  HIGH: 2,   // Visible in viewport
  MEDIUM: 1, // Near viewport
  LOW: 0     // Out of viewport
} as const;

// Increase max concurrent subscriptions since we're using priorities
const MAX_CONCURRENT_SUBSCRIPTIONS = 8; // Increased from 5

// Global subscription tracking
const activeSubscriptions = new Map<string, {
  cleanup: () => void,
  priority: number,
  lastAccessed: number
}>();

// Track which product IDs are currently using polling
const pollingProducts = new Set<string>();

// Track subscription attempts to prevent duplicates
const subscriptionAttempts = new Map<string, number>();
const MAX_SUBSCRIPTION_ATTEMPTS = 3;

// Track subscription priorities
const subscriptionPriorities = new Map<string, number>();

// Track active channels to prevent duplicate subscriptions
const activeChannels = new Map<string, RealtimeChannel>();

// Function to update subscription priority
function updateSubscriptionPriority(productId: string, priority: number) {
  subscriptionPriorities.set(productId, priority);
  const subscription = activeSubscriptions.get(productId);
  if (subscription) {
    subscription.priority = priority;
    prioritizeSubscriptions();
  }
}

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

export function useOrderStats(
  productId: string,
  options: {
    initialPriority?: number;
    deferLoad?: boolean;
  } = {}
) {
  const { 
    initialPriority = SUBSCRIPTION_PRIORITY.LOW,
    deferLoad = false
  } = options;

  const [stats, setStats] = useState<OrderStats>({
    currentOrders: 0,
    loading: !deferLoad, // Don't show loading if deferred
    error: null
  });
  const isFetchingRef = useRef(false);
  const pollingIntervalRef = useRef<any>(null);
  const cleanupFnsRef = useRef<Array<() => void>>([]);

  // Track if the component is mounted and visible
  const isMountedRef = useRef(false);
  const isVisibleRef = useRef(false);

  // Update priority when visibility changes
  const updatePriority = useCallback((isVisible: boolean) => {
    isVisibleRef.current = isVisible;
    const newPriority = isVisible ? 
      SUBSCRIPTION_PRIORITY.HIGH : 
      SUBSCRIPTION_PRIORITY.LOW;
    
    updateSubscriptionPriority(productId, newPriority);
  }, [productId]);

  // Setup intersection observer for visibility tracking
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const element = document.querySelector(`[data-product-id="${productId}"]`);
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          updatePriority(entry.isIntersecting);
        });
      },
      { rootMargin: '100px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [productId, updatePriority]);

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
    
    // Check if we've exceeded subscription attempts
    const attempts = subscriptionAttempts.get(productId) || 0;
    if (attempts >= MAX_SUBSCRIPTION_ATTEMPTS) {
      console.log(`Max subscription attempts reached for ${productId}, using polling`);
      startPolling();
      return;
    }
    subscriptionAttempts.set(productId, attempts + 1);
    
    // Clean up any existing subscriptions
    cleanupFnsRef.current.forEach(cleanup => cleanup());
    cleanupFnsRef.current = [];
    
    // Get current priority
    const priority = subscriptionPriorities.get(productId) || initialPriority;
    
    // Check if channel already exists
    const channelKey = `realtime:public_order_counts:filtered:product_id=eq.${productId}`;
    let channel = activeChannels.get(channelKey);
    
    // If channel exists but is in error state, remove it
    if (channel?.state === 'errored') {
      supabase.removeChannel(channel);
      activeChannels.delete(channelKey);
      channel = undefined;
    }
    
    // Create new channel if needed
    if (!channel) {
      channel = supabase.channel(channelKey);
      activeChannels.set(channelKey, channel);
    }
    
    // Subscribe to order counts updates with priority
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'public_order_counts',
          filter: `product_id=eq.${productId}`
        },
        (payload: any) => {
          updateAccessTime();
          console.log('Order count update detected:', productId, payload);
          
          if (payload.new?.total_orders !== undefined) {
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
            
            // Reset subscription attempts on successful update
            subscriptionAttempts.set(productId, 0);
          }
        }
      )
      .subscribe((status: string) => {
        console.log(`Channel ${channelKey} status:`, status);
        if (status === 'SUBSCRIBED') {
          // Reset attempts on successful subscription
          subscriptionAttempts.set(productId, 0);
        } else if (status === 'CHANNEL_ERROR') {
          // Remove errored channel
          activeChannels.delete(channelKey);
          // Increment attempt count
          const currentAttempts = subscriptionAttempts.get(productId) || 0;
          subscriptionAttempts.set(productId, currentAttempts + 1);
          // Switch to polling if max attempts reached
          if (currentAttempts + 1 >= MAX_SUBSCRIPTION_ATTEMPTS) {
            startPolling();
          }
        }
      });
    
    // Keep track of cleanup functions
    const cleanup = () => {
      if (channel) {
        channel.unsubscribe();
        supabase.removeChannel(channel);
        activeChannels.delete(channelKey);
      }
    };
    cleanupFnsRef.current.push(cleanup);
    
    // Setup monitoring for connection issues with increased check interval
    const setupConnectionMonitoring = () => {
      let unhealthyCount = 0;
      const MAX_UNHEALTHY_COUNT = 3;
      
      // Check connection status using Supabase's built-in method
      const checkHealth = () => {
        try {
          const channels = supabase.getChannels();
          const isHealthy = channels.length > 0 && 
            channels.some(ch => ch.state === 'joined');
          
          if (!isHealthy) {
            unhealthyCount++;
            console.log(`Connection check failed for ${productId} (${unhealthyCount}/${MAX_UNHEALTHY_COUNT})`);
            
            if (unhealthyCount >= MAX_UNHEALTHY_COUNT && !pollingProducts.has(productId)) {
              console.log(`Connection consistently unhealthy for ${productId}, switching to polling`);
              startPolling();
            }
          } else {
            unhealthyCount = 0;
          }
        } catch (err) {
          console.error('Error checking health:', err);
        }
      };
      
      // Initial check
      checkHealth();
      
      // Set up periodic check with increased interval
      const healthCheckInterval = setInterval(checkHealth, 45000); // 45 seconds
      
      // Cleanup function
      return () => clearInterval(healthCheckInterval);
    };
    
    const healthCheckCleanup = setupConnectionMonitoring();
    cleanupFnsRef.current.push(healthCheckCleanup);
    
    // Store overall cleanup function in activeSubscriptions
    const finalCleanup = () => {
      console.log(`Cleaning up subscriptions for ${productId}`);
      cleanupFnsRef.current.forEach(fn => fn());
      cleanupFnsRef.current = [];
      activeSubscriptions.delete(productId);
      // Reset subscription attempts on cleanup
      subscriptionAttempts.delete(productId);
    };
    
    // Store in the global subscription registry
    activeSubscriptions.set(productId, {
      cleanup: finalCleanup,
      priority: priority,
      lastAccessed: Date.now()
    });
    
    // Clear from polling products if we've switched to subscription
    pollingProducts.delete(productId);
    
    return finalCleanup;
  }, [productId, initialPriority, debouncedFetch, updateAccessTime, startPolling]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Set initial priority
    subscriptionPriorities.set(productId, initialPriority);

    // If deferred loading, wait for visibility
    if (deferLoad && initialPriority === SUBSCRIPTION_PRIORITY.LOW) {
      // Only fetch data when visible
      if (isVisibleRef.current) {
        fetchOrderStats();
      }
    } else {
      // Normal immediate loading
      fetchOrderStats();
    }

    // Setup connection based on priority
    const setupConnection = () => {
      const shouldUsePolling = 
        pollingProducts.has(productId) || 
        (getActiveSubscriptionCount() >= MAX_CONCURRENT_SUBSCRIPTIONS && 
         (subscriptionPriorities.get(productId) || 0) <= SUBSCRIPTION_PRIORITY.LOW);
      
      if (shouldUsePolling) {
        console.log(`Using polling for ${productId} (${getActiveSubscriptionCount()}/${MAX_CONCURRENT_SUBSCRIPTIONS} active subscriptions)`);
        startPolling();
      } else {
        const result = setupSubscriptions();
        const cleanupFn = result || null;
        
        if (cleanupFn) {
          prioritizeSubscriptions();
        }
      }
    };

    // Setup connection strategy
    setupConnection();

    return () => {
      isMountedRef.current = false;
      subscriptionPriorities.delete(productId);
      // Remove from active subscriptions
      cleanupFnsRef.current.forEach(fn => fn());
      cleanupFnsRef.current = [];
      
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
  }, [productId, initialPriority, deferLoad, fetchOrderStats, setupSubscriptions]);

  return stats;
}