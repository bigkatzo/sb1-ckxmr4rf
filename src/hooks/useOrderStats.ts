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
const RETRY_DELAY = 2000; // 2 seconds delay between attempts

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

// Add page type detection
function isProductPage(): boolean {
  return window.location.pathname.includes('/product/');
}

export function useOrderStats(
  productId: string,
  options: {
    initialPriority?: number;
    deferLoad?: boolean;
    isMainView?: boolean; // New option to indicate if this is the main product view
  } = {}
) {
  const { 
    initialPriority = isProductPage() ? SUBSCRIPTION_PRIORITY.HIGH : SUBSCRIPTION_PRIORITY.LOW,
    deferLoad = false,
    isMainView = isProductPage()
  } = options;

  const [stats, setStats] = useState<OrderStats>({
    currentOrders: 0,
    loading: !deferLoad,
    error: null
  });
  const isFetchingRef = useRef(false);
  const pollingIntervalRef = useRef<any>(null);
  const cleanupFnsRef = useRef<Array<() => void>>([]);

  // Track if the component is mounted and visible
  const isMountedRef = useRef(false);
  const isVisibleRef = useRef(false);

  // Add priority upgrade timeout ref
  const priorityUpgradeTimeoutRef = useRef<NodeJS.Timeout>();

  // Update priority when visibility changes
  const updatePriority = useCallback((isVisible: boolean) => {
    isVisibleRef.current = isVisible;
    const newPriority = isVisible || isMainView ? 
      SUBSCRIPTION_PRIORITY.HIGH : 
      SUBSCRIPTION_PRIORITY.LOW;
    
    updateSubscriptionPriority(productId, newPriority);
  }, [productId, isMainView]);

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
      
      // Create a supabase client with the proper headers for this specific request
      const clientWithHeaders = supabase.from('public_order_counts').select('total_orders').eq('product_id', productId).single();
      
      // Set request headers directly on the underlying fetch call
      const { data, error } = await clientWithHeaders;

      // Handle the case where the product no longer exists or has no order data
      if (error) {
        // If error code is PGRST116 (no rows found), simply set count to 0
        if (error.code === 'PGRST116') {
          // Product likely deleted or has no orders - set to 0 quietly
          setStats({
            currentOrders: 0,
            loading: false,
            error: null
          });
          
          // Update cache to prevent repeated errors
          await cacheManager.set(
            `order_stats:${productId}`, 
            0, 
            CACHE_DURATIONS.REALTIME.TTL,
            { staleTime: CACHE_DURATIONS.REALTIME.STALE }
          );
          
          return; // Exit gracefully
        }
        
        // Other errors should be thrown
        throw error;
      }

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

  // Add handleRealtimeUpdate function
  const handleRealtimeUpdate = useCallback((payload: any) => {
    updateAccessTime();
    console.log('Order count update detected:', productId, payload);
    
    if (payload.new?.total_orders !== undefined) {
      const orderCount = payload.new.total_orders || 0;
      
      // Update cache with new options format
      void cacheManager.set(
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
  }, [productId, updateAccessTime]);

  // Setup subscriptions using shared channel approach
  const setupSubscriptions = useCallback(() => {
    console.log(`Setting up subscriptions for ${productId}`);
    
    // Check if we've exceeded subscription attempts
    const currentAttempts = subscriptionAttempts.get(productId) || 0;
    if (currentAttempts >= MAX_SUBSCRIPTION_ATTEMPTS) {
      console.log(`Max subscription attempts reached for ${productId}, using polling`);
      startPolling();
      return;
    }
    
    // Add delay between attempts
    if (currentAttempts > 0) {
      console.log(`Waiting ${RETRY_DELAY}ms before retry attempt ${currentAttempts + 1}`);
      setTimeout(() => {
        setupSubscriptionWithRetry();
      }, RETRY_DELAY);
      return;
    }
    
    setupSubscriptionWithRetry();
  }, [productId, handleRealtimeUpdate, startPolling]);

  // Separate the subscription logic
  const setupSubscriptionWithRetry = useCallback(() => {
    // Don't proceed if component is unmounted
    if (!isMountedRef.current) return;

    const currentAttempts = subscriptionAttempts.get(productId) || 0;
    subscriptionAttempts.set(productId, currentAttempts + 1);
    
    // Clean up any existing subscriptions
    cleanupFnsRef.current.forEach(cleanup => cleanup());
    cleanupFnsRef.current = [];
    
    // Check if channel already exists
    const channelKey = `realtime:public_order_counts:filtered:product_id=eq.${productId}`;
    let channel = activeChannels.get(channelKey);
    
    // If channel exists but is in error state or closed, remove it
    if (channel?.state === 'errored' || channel?.state === 'closed') {
      try {
        channel.unsubscribe();
        if (channel) {
          supabase.removeChannel(channel);
        }
      } catch (e) {
        console.warn(`Error cleaning up channel ${channelKey}:`, e);
      }
      activeChannels.delete(channelKey);
      channel = undefined;
    }
    
    // Only create new channel if one doesn't exist or previous was removed
    if (!channel) {
      try {
        // Don't create new channel if component is unmounted
        if (!isMountedRef.current) return;

        channel = supabase.channel(channelKey, {
          config: {
            broadcast: { self: true }
          }
        });
        
        // Add subscription before storing the channel
        channel
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'order_counts',
              filter: `product_id=eq.${productId}`
            },
            (payload) => {
              // Only process updates if component is still mounted
              if (isMountedRef.current) {
                handleRealtimeUpdate(payload);
              }
            }
          )
          .subscribe((status) => {
            // Don't process status updates if component is unmounted
            if (!isMountedRef.current) return;

            console.log(`Channel ${channelKey} status:`, status, {
              existingAttempts: subscriptionAttempts.get(productId),
              channelState: channel?.state,
              activeSubscriptions: Array.from(activeSubscriptions.keys()).length,
              isMounted: isMountedRef.current
            });

            if (status === 'SUBSCRIBED') {
              console.log(`Successfully subscribed to ${channelKey}`);
              subscriptionAttempts.delete(productId); // Reset attempts on successful subscription
              
              // Register with active subscriptions
              activeSubscriptions.set(productId, {
                cleanup: () => {
                  channel?.unsubscribe();
                  activeChannels.delete(channelKey);
                },
                priority: subscriptionPriorities.get(productId) || SUBSCRIPTION_PRIORITY.LOW,
                lastAccessed: Date.now()
              });
            } else if (status === 'CHANNEL_ERROR') {
              const currentAttempts = subscriptionAttempts.get(productId) || 0;
              console.error(`Channel error for ${channelKey}:`, {
                attempt: currentAttempts + 1,
                maxAttempts: MAX_SUBSCRIPTION_ATTEMPTS,
                channelState: channel?.state,
                isMounted: isMountedRef.current
              });
              
              // Only increment attempts and potentially switch to polling if still mounted
              if (isMountedRef.current && currentAttempts + 1 >= MAX_SUBSCRIPTION_ATTEMPTS) {
                console.log(`Falling back to polling for ${productId}`);
                startPolling();
              }
            } else if (status === 'CLOSED') {
              // Clean removal from tracking
              activeSubscriptions.delete(productId);
              activeChannels.delete(channelKey);
            }
          });
          
        activeChannels.set(channelKey, channel);
        
        // Add cleanup function
        cleanupFnsRef.current.push(() => {
          try {
            if (channel) {
              channel.unsubscribe();
              supabase.removeChannel(channel);
            }
            activeChannels.delete(channelKey);
            activeSubscriptions.delete(productId);
          } catch (e) {
            console.warn(`Error during cleanup for ${channelKey}:`, e);
          }
        });
      } catch (error) {
        console.error(`Error setting up channel ${channelKey}:`, error);
        if (isMountedRef.current) {
          startPolling(); // Only start polling if still mounted
        }
      }
    }
  }, [productId, handleRealtimeUpdate, startPolling]);

  // Setup connection based on priority with delay
  const setupConnection = useCallback(() => {
    const currentPriority = subscriptionPriorities.get(productId) || initialPriority;
    const activeCount = getActiveSubscriptionCount();
    
    // Clear any existing priority upgrade timeout
    if (priorityUpgradeTimeoutRef.current) {
      clearTimeout(priorityUpgradeTimeoutRef.current);
    }

    const shouldUsePolling = 
      pollingProducts.has(productId) || 
      (activeCount >= MAX_CONCURRENT_SUBSCRIPTIONS && 
       currentPriority <= SUBSCRIPTION_PRIORITY.LOW && 
       !isMainView); // Don't use polling for main product view initially
    
    if (shouldUsePolling) {
      // For non-main views, add a small delay before falling back to polling
      // to allow visibility detection to complete
      if (!isMainView) {
        priorityUpgradeTimeoutRef.current = setTimeout(() => {
          const updatedPriority = subscriptionPriorities.get(productId) || currentPriority;
          if (updatedPriority <= SUBSCRIPTION_PRIORITY.LOW) {
            console.log(`Using polling for ${productId} (${getActiveSubscriptionCount()}/${MAX_CONCURRENT_SUBSCRIPTIONS} active subscriptions)`);
            startPolling();
          } else {
            setupSubscriptions();
          }
        }, 500); // 500ms delay to allow visibility detection
      } else {
        // For main view, always try subscription first
        setupSubscriptions();
      }
    } else {
      setupSubscriptions();
      prioritizeSubscriptions();
    }
  }, [productId, initialPriority, isMainView, setupSubscriptions, startPolling]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Set initial priority
    const initialPriorityValue = isMainView ? SUBSCRIPTION_PRIORITY.HIGH : initialPriority;
    subscriptionPriorities.set(productId, initialPriorityValue);

    // If deferred loading, wait for visibility unless it's the main view
    if (deferLoad && !isMainView && initialPriorityValue === SUBSCRIPTION_PRIORITY.LOW) {
      if (isVisibleRef.current) {
        fetchOrderStats();
      }
    } else {
      fetchOrderStats();
    }

    // Setup initial connection
    setupConnection();

    return () => {
      isMountedRef.current = false;
      
      // Clear priority upgrade timeout
      if (priorityUpgradeTimeoutRef.current) {
        clearTimeout(priorityUpgradeTimeoutRef.current);
      }
      
      // Reset subscription attempts since this is a clean unmount
      subscriptionAttempts.delete(productId);
      
      // Remove from active subscriptions and cleanup
      cleanupFnsRef.current.forEach(fn => fn());
      cleanupFnsRef.current = [];
      
      // Clear polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Remove from all tracking
      subscriptionPriorities.delete(productId);
      pollingProducts.delete(productId);
      const channelKey = `realtime:public_order_counts:filtered:product_id=eq.${productId}`;
      activeChannels.delete(channelKey);
      
      // Cancel any pending debounced fetches
      debouncedFetch.cancel();
    };
  }, [productId, initialPriority, deferLoad, isMainView, fetchOrderStats, setupConnection]);

  return stats;
}