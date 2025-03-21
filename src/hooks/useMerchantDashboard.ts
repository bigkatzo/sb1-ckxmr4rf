import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { isRealtimeConnectionHealthy } from '../lib/realtime/subscriptions';
import { RealtimeChannel } from '@supabase/supabase-js';

// Debounce duration for realtime updates (500ms)
const REALTIME_DEBOUNCE_DURATION = 500;

// Priority levels for subscriptions
const SUBSCRIPTION_PRIORITY = {
  HIGH: 2,   // Active tab
  MEDIUM: 1, // Background tab
  LOW: 0     // Inactive tab
} as const;

// Global subscription tracking
const activeSubscriptions = new Map<string, {
  cleanup: () => void,
  priority: number,
  lastAccessed: number
}>();

// Track subscription attempts to prevent duplicates
const subscriptionAttempts = new Map<string, number>();
const MAX_SUBSCRIPTION_ATTEMPTS = 3;

// Track subscription priorities
const subscriptionPriorities = new Map<string, number>();

// Function to update subscription priority
function updateSubscriptionPriority(subscriptionId: string, priority: number) {
  subscriptionPriorities.set(subscriptionId, priority);
  const subscription = activeSubscriptions.get(subscriptionId);
  if (subscription) {
    subscription.priority = priority;
  }
}

// Polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
  ORDERS: 30 * 1000,        // 30 seconds
  INVENTORY: 5 * 60 * 1000, // 5 minutes
  ANALYTICS: 15 * 60 * 1000 // 15 minutes
} as const;

// Subscription types with different behaviors
export const SUBSCRIPTION_TYPES = {
  REALTIME: 'realtime',   // Use WebSocket subscription
  POLLING: 'polling',     // Use interval-based polling
  MANUAL: 'manual'        // Manual refresh only
} as const;

interface UseMerchantDashboardOptions {
  initialPriority?: number;
  deferLoad?: boolean;
  elementRef?: React.RefObject<HTMLDivElement>;
  tables: string[];
  subscriptionId: string;
  onDataChange?: () => Promise<void>;
  type?: typeof SUBSCRIPTION_TYPES[keyof typeof SUBSCRIPTION_TYPES];
  pollingInterval?: number;
  maxRetries?: number;
}

export function useMerchantDashboard(options: UseMerchantDashboardOptions) {
  const {
    initialPriority = SUBSCRIPTION_PRIORITY.LOW,
    deferLoad = false,
    tables,
    subscriptionId,
    onDataChange,
    type = SUBSCRIPTION_TYPES.MANUAL,
    pollingInterval
  } = options;

  const channelsRef = useRef<{ [key: string]: RealtimeChannel }>({});
  const isMountedRef = useRef(false);
  const cleanupFnsRef = useRef<Array<() => void>>([]);
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();
  const isSubscribedRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout>();

  const [loading, setLoading] = useState(!deferLoad);
  const [error, setError] = useState<string | null>(null);

  // Update last accessed time
  const updateAccessTime = useCallback(() => {
    const subscription = activeSubscriptions.get(subscriptionId);
    if (subscription) {
      activeSubscriptions.set(subscriptionId, {
        ...subscription,
        lastAccessed: Date.now()
      });
    }
  }, [subscriptionId]);

  // Debounced data refresh
  const debouncedRefresh = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    fetchTimeoutRef.current = setTimeout(() => {
      if (onDataChange) {
        onDataChange().catch(console.error);
      }
    }, REALTIME_DEBOUNCE_DURATION);
  }, [onDataChange]);

  // Setup polling if needed
  const setupPolling = useCallback(() => {
    if (type !== SUBSCRIPTION_TYPES.POLLING || !pollingInterval) return;

    pollingIntervalRef.current = setInterval(() => {
      if (onDataChange) {
        onDataChange().catch(console.error);
      }
    }, pollingInterval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [type, pollingInterval, onDataChange]);

  const setupSubscriptions = useCallback(() => {
    if (type !== SUBSCRIPTION_TYPES.REALTIME) return;
    
    // Don't setup if already subscribed
    if (isSubscribedRef.current) {
      return;
    }

    // Check if we've exceeded subscription attempts
    const attempts = subscriptionAttempts.get(subscriptionId) || 0;
    if (attempts >= MAX_SUBSCRIPTION_ATTEMPTS) {
      console.log(`Max subscription attempts reached for ${subscriptionId}`);
      return;
    }
    subscriptionAttempts.set(subscriptionId, attempts + 1);

    // Clean up any existing subscriptions first
    const cleanupExistingSubscriptions = () => {
      Object.entries(channelsRef.current).forEach(([key, channel]) => {
        if (channel) {
          channel.unsubscribe();
          delete channelsRef.current[key];
        }
      });
    };

    cleanupExistingSubscriptions();
    cleanupFnsRef.current = []; // Reset cleanup functions

    // Set up realtime subscriptions for each table
    tables.forEach(table => {
      const channel = supabase.channel(`${subscriptionId}_${table}`);
      channelsRef.current[table] = channel;

      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table
          },
          () => {
            updateAccessTime();
            debouncedRefresh();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isSubscribedRef.current = true;
          }
          console.log(`${table} subscription status:`, status);
          if (status === 'CHANNEL_ERROR') {
            console.warn(`${table} subscription error, will try to reconnect`);
            isSubscribedRef.current = false;
          }
          if (status === 'CLOSED') {
            isSubscribedRef.current = false;
          }
        });
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
            console.log(`Connection check failed for ${subscriptionId} (${unhealthyCount}/${MAX_UNHEALTHY_COUNT})`);
            
            if (unhealthyCount >= MAX_UNHEALTHY_COUNT) {
              console.log(`Connection consistently unhealthy for ${subscriptionId}`);
              if (onDataChange) {
                onDataChange().catch(console.error);
              }
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

    // Main cleanup function that will be called on unmount
    const cleanup = () => {
      if (!isMountedRef.current) return; // Don't cleanup if already unmounted
      console.log(`Cleaning up ${subscriptionId} subscriptions`);
      cleanupExistingSubscriptions();
      if (healthCheckCleanup) {
        healthCheckCleanup();
      }
      activeSubscriptions.delete(subscriptionId);
      subscriptionAttempts.delete(subscriptionId);
      isSubscribedRef.current = false;
    };

    // Store in global subscription registry
    activeSubscriptions.set(subscriptionId, {
      cleanup,
      priority: initialPriority,
      lastAccessed: Date.now()
    });

    // Store cleanup function for useEffect
    cleanupFnsRef.current = [cleanup];
  }, [type, subscriptionId, tables, initialPriority, updateAccessTime, debouncedRefresh]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Set initial priority
    subscriptionPriorities.set(subscriptionId, initialPriority);

    // Setup visibility tracking
    if (options.elementRef?.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            const newPriority = entry.isIntersecting ? 
              SUBSCRIPTION_PRIORITY.HIGH : 
              SUBSCRIPTION_PRIORITY.LOW;
            updateSubscriptionPriority(subscriptionId, newPriority);
            
            // Only refresh on visibility if using realtime or polling
            if (entry.isIntersecting && onDataChange && type !== SUBSCRIPTION_TYPES.MANUAL) {
              onDataChange().catch(console.error);
            }
          });
        },
        { rootMargin: '100px' }
      );

      observer.observe(options.elementRef.current);
      cleanupFnsRef.current.push(() => observer.disconnect());
    }

    // Initial setup based on type
    if (!deferLoad || initialPriority === SUBSCRIPTION_PRIORITY.HIGH) {
      if (onDataChange) {
        onDataChange().catch(console.error);
      }
      if (type === SUBSCRIPTION_TYPES.REALTIME) {
        setupSubscriptions();
      } else if (type === SUBSCRIPTION_TYPES.POLLING) {
        setupPolling();
      }
    }

    return () => {
      const cleanup = () => {
        isMountedRef.current = false;
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        cleanupFnsRef.current.forEach(cleanup => {
          if (cleanup) cleanup();
        });
        cleanupFnsRef.current = [];
        isSubscribedRef.current = false;
      };
      cleanup();
    };
  }, [
    subscriptionId, 
    initialPriority, 
    deferLoad, 
    setupSubscriptions, 
    setupPolling,
    onDataChange, 
    type
  ]);

  return {
    loading,
    error,
    setError,
    setLoading,
    refresh: onDataChange
  };
} 