import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { isRealtimeConnectionHealthy } from '../lib/realtime/subscriptions';

interface ProductStockData {
  stock: number | null;
  loading: boolean;
  error: string | null;
}

interface ProductStockRecord {
  quantity: number;
}

// Priority levels for subscriptions
const SUBSCRIPTION_PRIORITY = {
  HIGH: 2,   // Visible in viewport
  MEDIUM: 1, // Near viewport
  LOW: 0     // Out of viewport
} as const;

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

// Function to update subscription priority
function updateSubscriptionPriority(productId: string, priority: number) {
  subscriptionPriorities.set(productId, priority);
  const subscription = activeSubscriptions.get(productId);
  if (subscription) {
    subscription.priority = priority;
  }
}

/**
 * Hook for tracking product stock in real-time
 * Uses a combination of caching and real-time subscriptions with priority-based loading
 */
export function useProductStock(
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

  const [stockData, setStockData] = useState<ProductStockData>({
    stock: null,
    loading: !deferLoad,
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

  // Start polling as a fallback if realtime fails
  const startPolling = useCallback(() => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Mark this product as using polling
    pollingProducts.add(productId);
    
    console.log(`Starting polling fallback for stock updates for ${productId}`);
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', productId)
          .single();
          
        if (error) throw error;
        
        const currentStock = data?.quantity;
        
        // Update cache
        await cacheManager.set(
          `product_stock:${productId}`, 
          currentStock, 
          CACHE_DURATIONS.REALTIME.TTL,
          { staleTime: CACHE_DURATIONS.REALTIME.STALE }
        );
        
        if (isMountedRef.current) {
          setStockData({
            stock: currentStock,
            loading: false,
            error: null
          });
        }
      } catch (err) {
        console.error('Error polling stock:', err);
      }
    }, 30000); // Poll every 30 seconds
  }, [productId]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Set initial priority
    subscriptionPriorities.set(productId, initialPriority);

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
          if (isMountedRef.current) {
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
        if (updateLoadingState && isMountedRef.current) {
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
        
        // Very short TTL for stock data
        await cacheManager.set(
          `product_stock:${productId}`, 
          currentStock, 
          CACHE_DURATIONS.REALTIME.TTL,
          { staleTime: CACHE_DURATIONS.REALTIME.STALE }
        );
        
        if (isMountedRef.current) {
          setStockData({
            stock: currentStock,
            loading: false,
            error: null
          });
        }
      } catch (err) {
        console.error('Error fetching product stock:', err);
        if (isMountedRef.current && updateLoadingState) {
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

    // If deferred loading, wait for visibility
    if (deferLoad && initialPriority === SUBSCRIPTION_PRIORITY.LOW) {
      // Only fetch data when visible
      if (isVisibleRef.current) {
        fetchStock();
      }
    } else {
      // Normal immediate loading
      fetchStock();
    }

    // Setup realtime subscription with priority-based loading
    const setupSubscription = () => {
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

      const subscription = supabase.channel(`product_stock_${productId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'public_products',
            filter: `id=eq.${productId}`
          },
          (payload: RealtimePostgresChangesPayload<ProductStockRecord>) => {
            updateAccessTime();
            console.log(`Stock update received for ${productId}:`, payload);
            
            const newData = payload.new as ProductStockRecord;
            if (isMountedRef.current && newData?.quantity !== undefined) {
              console.log('Stock quantity changed, updating state:', newData.quantity);
              
              // Update cache
              cacheManager.set(
                `product_stock:${productId}`, 
                newData.quantity, 
                CACHE_DURATIONS.REALTIME.TTL,
                { staleTime: CACHE_DURATIONS.REALTIME.STALE }
              ).catch(err => {
                console.error('Error updating stock cache:', err);
              });
              
              // Update state
              setStockData({
                stock: newData.quantity,
                loading: false,
                error: null
              });

              // Reset subscription attempts on successful update
              subscriptionAttempts.set(productId, 0);
            }
          }
        )
        .subscribe((status) => {
          console.log(`Stock subscription status for ${productId}:`, status);
          if (status === 'CHANNEL_ERROR') {
            console.warn(`Stock subscription error for ${productId}, will try to reconnect`);
          }
        });

      // Setup monitoring for connection issues
      const setupConnectionMonitoring = () => {
        let unhealthyCount = 0;
        const MAX_UNHEALTHY_COUNT = 3;
        
        // Check global health flag
        const checkHealth = () => {
          try {
            const isHealthy = isRealtimeConnectionHealthy();
            
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
        
        // Set up periodic check
        const healthCheckInterval = setInterval(checkHealth, 45000); // 45 seconds
        
        return () => clearInterval(healthCheckInterval);
      };

      const healthCheckCleanup = setupConnectionMonitoring();
      cleanupFnsRef.current.push(healthCheckCleanup);

      // Store cleanup function
      const cleanup = () => {
        console.log(`Cleaning up stock subscription for ${productId}`);
        subscription.unsubscribe();
        cleanupFnsRef.current.forEach(fn => fn());
        cleanupFnsRef.current = [];
        activeSubscriptions.delete(productId);
        subscriptionAttempts.delete(productId);
      };

      // Store in global subscription registry
      activeSubscriptions.set(productId, {
        cleanup,
        priority: initialPriority,
        lastAccessed: Date.now()
      });

      // Clear from polling products if we've switched to subscription
      pollingProducts.delete(productId);

      cleanupFnsRef.current.push(cleanup);
    };

    // Setup subscription if not deferred or if visible
    if (!deferLoad || isVisibleRef.current) {
      setupSubscription();
    }

    return () => {
      isMountedRef.current = false;
      subscriptionPriorities.delete(productId);
      
      // Clean up subscriptions
      cleanupFnsRef.current.forEach(fn => fn());
      cleanupFnsRef.current = [];
      
      // Clear polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Remove from polling products
      pollingProducts.delete(productId);
    };
  }, [productId, initialPriority, deferLoad, startPolling, updateAccessTime]);

  return stockData;
} 