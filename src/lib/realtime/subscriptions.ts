import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { ConnectionManager } from './ConnectionManager';
import { SubscriptionManager } from './SubscriptionManager';
import { CircuitBreaker } from './CircuitBreaker';
import { logger } from './logger';

export type DatabaseChanges = {
  [key: string]: any;
};

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export type Unsubscribable = {
  unsubscribe: () => void;
};

// Create circuit breakers for different subscription types
const circuitBreakers = {
  orders: new CircuitBreaker('orders', { maxFailures: 5, resetTimeout: 60000 }),
  products: new CircuitBreaker('products', { maxFailures: 3, resetTimeout: 30000 }),
  collections: new CircuitBreaker('collections', { maxFailures: 3, resetTimeout: 45000 })
};

/**
 * Check if the Supabase Realtime connection is healthy
 */
export function isRealtimeConnectionHealthy(): boolean {
  const channels = supabase.getChannels();
  return channels.some(channel => channel.state === 'joined');
}

/**
 * Setup realtime health monitoring
 */
export function setupRealtimeHealth(options: {
  onHealthChange?: (isHealthy: boolean) => void;
} = {}): Unsubscribable {
  const { onHealthChange } = options;
  let lastHealthState = isRealtimeConnectionHealthy();
  
  onHealthChange?.(lastHealthState);
  
  const channel = supabase.channel('health_monitor')
    .on('system', { event: 'disconnect' }, () => {
      if (lastHealthState) {
        logger.warn('Realtime connection lost');
        lastHealthState = false;
        onHealthChange?.(false);
      }
    })
    .on('system', { event: 'reconnected' }, () => {
      if (!lastHealthState) {
        logger.info('Realtime connection restored');
        lastHealthState = true;
        onHealthChange?.(true);
      }
    })
    .on('system', { event: 'connected' }, () => {
      if (!lastHealthState) {
        logger.info('Realtime connection established');
        lastHealthState = true;
        onHealthChange?.(true);
      }
    })
    .subscribe();

  const unsubscribable: Unsubscribable = {
    unsubscribe: () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    }
  };

  return unsubscribable;
}

/**
 * Subscribe to changes on a specific table with a filter
 */
export async function subscribeToFilteredChanges<T extends DatabaseChanges>(
  tableName: string,
  filter: { [key: string]: string },
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  event: RealtimeEvent = '*'
): Promise<Unsubscribable> {
  const filterString = Object.entries(filter)
    .map(([key, value]) => `${key}=eq.${value}`)
    .join(',');

  const channelName = `realtime:${tableName}:filtered:${filterString}`;
  const manager = ConnectionManager.getInstance(supabase);
  const subscriptionManager = SubscriptionManager.getInstance();
  
  // Determine circuit breaker and priority
  const circuitBreaker = tableName.includes('order') ? circuitBreakers.orders :
                        tableName.includes('product') ? circuitBreakers.products :
                        tableName.includes('collection') ? circuitBreakers.collections :
                        null;
  
  const priority = tableName.includes('order') || tableName.includes('product') ? 2 : 0;

  try {
    // Create channel with error handling
    let channel: RealtimeChannel | null = null;
    
    if (circuitBreaker) {
      channel = await circuitBreaker.execute<RealtimeChannel>(() => 
        Promise.resolve(manager.createChannel(channelName, {
          config: { broadcast: { self: true } }
        }, priority))
      );
    } else {
      channel = manager.createChannel(channelName, {
        config: { broadcast: { self: true } }
      }, priority);
    }

    if (!channel) {
      logger.error(`Failed to create channel for ${channelName}`);
      return { unsubscribe: () => {} };
    }

    channel
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table: tableName,
          filter: filterString
        },
        callback
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          logger.debug(`Channel ${channelName} subscribed`, { samplingRate: 0.1 });
        } else if (status === 'CHANNEL_ERROR') {
          logger.warn(`Channel error for ${channelName}`);
          subscriptionManager.markError(channelName);
        }
      });

    // Register with subscription manager
    subscriptionManager.registerSubscription(
      channelName,
      () => {
        channel?.unsubscribe();
        manager.removeChannel(channelName);
      },
      priority
    );

    const unsubscribable: Unsubscribable = {
      unsubscribe: () => {
        channel?.unsubscribe();
        manager.removeChannel(channelName);
        // No need to remove from subscription manager as it will be cleaned up automatically
      }
    };

    return unsubscribable;
  } catch (error) {
    logger.error(`Failed to setup subscription for ${channelName}`, {
      context: { error }
    });
    return { unsubscribe: () => {} };
  }
}

// Collection-specific subscriptions with circuit breaker protection
export async function subscribeToCollection(
  collectionId: string,
  callback: (payload: RealtimePostgresChangesPayload<any>) => void,
  event?: RealtimeEvent
): Promise<Unsubscribable> {
  return await subscribeToFilteredChanges(
    'collections',
    { id: collectionId },
    callback,
    event
  );
}

export async function subscribeToCollectionProducts(
  collectionId: string,
  callback: (payload: RealtimePostgresChangesPayload<any>) => void,
  event?: RealtimeEvent
): Promise<Unsubscribable> {
  return await subscribeToFilteredChanges(
    'collection_products',
    { collection_id: collectionId },
    callback,
    event
  );
}

export async function subscribeToSharedTableChanges<T extends DatabaseChanges>(
  tableName: string,
  filter: { [key: string]: any },
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  event: RealtimeEvent = '*'
): Promise<Unsubscribable> {
  return await subscribeToFilteredChanges(tableName, filter, callback, event);
}

export async function subscribeToCollectionCategories(
  collectionId: string,
  callback: (payload: RealtimePostgresChangesPayload<any>) => void,
  event?: RealtimeEvent
): Promise<Unsubscribable> {
  return await subscribeToFilteredChanges(
    'collection_categories',
    { collection_id: collectionId },
    callback,
    event
  );
}

/**
 * Example usage in React:
 * 
 * ```typescript
 * useEffect(() => {
 *   const subscription = subscribeToCollectionProducts(
 *     collectionId,
 *     (payload) => {
 *       console.log('Product updated:', payload);
 *     },
 *     'UPDATE' // Only listen for updates
 *   );
 * 
 *   return () => subscription.unsubscribe(); // Properly cleanup subscription and channel
 * }, [collectionId]);
 * ```
 */