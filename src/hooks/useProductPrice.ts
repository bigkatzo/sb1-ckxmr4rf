import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { isRealtimeConnectionHealthy } from '../lib/realtime/subscriptions';

interface ProductPriceData {
  basePrice: number | null;
  variantPrices: Record<string, number> | null;
  priceModifierBeforeMin: number | null;
  priceModifierAfterMin: number | null;
  loading: boolean;
  error: string | null;
}

interface ProductPriceRecord {
  price: number | null;
  variant_prices: Record<string, number> | null;
  price_modifier_before_min: number | null;
  price_modifier_after_min: number | null;
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
 * Hook for tracking product pricing in real-time
 * Uses a combination of caching and real-time subscriptions with priority-based loading
 */
export function useProductPrice(
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

  const [priceData, setPriceData] = useState<ProductPriceData>({
    basePrice: null,
    variantPrices: null,
    priceModifierBeforeMin: null,
    priceModifierAfterMin: null,
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
    
    console.log(`Starting polling fallback for price updates for ${productId}`);
    pollingIntervalRef.current = setInterval(async () => {
      try {
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
        
        // Update cache
        await cacheManager.set(
          `product_price:${productId}`, 
          priceInfo, 
          CACHE_DURATIONS.REALTIME.TTL,
          { staleTime: CACHE_DURATIONS.REALTIME.STALE }
        );
        
        if (isMountedRef.current) {
          setPriceData({
            ...priceInfo,
            loading: false,
            error: null
          });
        }
      } catch (err) {
        console.error('Error polling price:', err);
      }
    }, 30000); // Poll every 30 seconds
  }, [productId]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Set initial priority
    subscriptionPriorities.set(productId, initialPriority);

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
          if (isMountedRef.current) {
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
        if (updateLoadingState && isMountedRef.current) {
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
        
        // Update cache
        await cacheManager.set(
          `product_price:${productId}`, 
          priceInfo, 
          CACHE_DURATIONS.REALTIME.TTL,
          { staleTime: CACHE_DURATIONS.REALTIME.STALE }
        );
        
        if (isMountedRef.current) {
          setPriceData({
            ...priceInfo,
            loading: false,
            error: null
          });
        }
      } catch (err) {
        console.error('Error fetching product price:', err);
        if (isMountedRef.current && updateLoadingState) {
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

    // If deferred loading, wait for visibility
    if (deferLoad && initialPriority === SUBSCRIPTION_PRIORITY.LOW) {
      // Only fetch data when visible
      if (isVisibleRef.current) {
        fetchPrice();
      }
    } else {
      // Normal immediate loading
      fetchPrice();
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
            updateAccessTime();
            console.log(`Price update received for ${productId}:`, payload);
            if (!isMountedRef.current) return;
            
            const newData = payload.new as ProductPriceRecord;
            const oldData = payload.old as ProductPriceRecord;
            
            // Check if any price-related fields changed
            const priceChanged = 
              'price' in newData !== 'price' in oldData ||
              ('price' in newData && 'price' in oldData && newData.price !== oldData.price) ||
              JSON.stringify(newData?.variant_prices) !== JSON.stringify(oldData?.variant_prices) ||
              newData?.price_modifier_before_min !== oldData?.price_modifier_before_min ||
              newData?.price_modifier_after_min !== oldData?.price_modifier_after_min;

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
              
              // Update cache
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

              // Reset subscription attempts on successful update
              subscriptionAttempts.set(productId, 0);
            }
          }
        )
        .subscribe((status) => {
          console.log(`Price subscription status for ${productId}:`, status);
          if (status === 'CHANNEL_ERROR') {
            console.warn(`Price subscription error for ${productId}, will try to reconnect`);
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
        console.log(`Cleaning up price subscription for ${productId}`);
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

  return priceData;
} 