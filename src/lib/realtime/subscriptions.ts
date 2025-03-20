import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export type DatabaseChanges = {
  [key: string]: any;
};

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export type Unsubscribable = {
  unsubscribe: () => void;
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
 * This function sets up listeners for connection state changes
 * and notifies when the connection state changes
 */
export function setupRealtimeHealth(options: {
  onHealthChange?: (isHealthy: boolean) => void;
} = {}): Unsubscribable {
  const { onHealthChange } = options;
  let lastHealthState = isRealtimeConnectionHealthy();
  
  // Initial health state notification
  onHealthChange?.(lastHealthState);
  
  // Listen to Supabase's built-in connection events
  const channel = supabase.channel('health_monitor')
    .on('system', { event: 'disconnect' }, () => {
      if (lastHealthState) {
        console.warn('Realtime connection lost');
        lastHealthState = false;
        onHealthChange?.(false);
      }
    })
    .on('system', { event: 'reconnected' }, () => {
      if (!lastHealthState) {
        console.log('Realtime connection restored');
        lastHealthState = true;
        onHealthChange?.(true);
      }
    })
    .on('system', { event: 'connected' }, () => {
      if (!lastHealthState) {
        console.log('Realtime connection established');
        lastHealthState = true;
        onHealthChange?.(true);
      }
    })
    .subscribe();

  return {
    unsubscribe: () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    }
  };
}

/**
 * Subscribe to changes on a shared table with filtering
 */
export function subscribeToSharedTableChanges<T extends DatabaseChanges>(
  tableName: string,
  filter: { [key: string]: any },
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  event: RealtimeEvent = '*'
): Unsubscribable {
  return subscribeToFilteredChanges(tableName, filter, callback, event);
}

/**
 * Subscribe to changes on a specific table
 */
export function subscribeToChanges<T extends DatabaseChanges>(
  tableName: string,
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  event: RealtimeEvent = '*'
): Unsubscribable {
  const channel = supabase.channel(`realtime:${tableName}:changes`);

  channel
    .on(
      'postgres_changes',
      {
        event,
      schema: 'public',
        table: tableName
      },
      callback
    )
    .subscribe();

  return {
    unsubscribe: () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    }
  };
}

/**
 * Subscribe to changes on a specific table with a filter
 */
export function subscribeToFilteredChanges<T extends DatabaseChanges>(
  tableName: string,
  filter: { [key: string]: string },
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  event: RealtimeEvent = '*'
): Unsubscribable {
  const filterString = Object.entries(filter)
    .map(([key, value]) => `${key}=eq.${value}`)
    .join(',');

  const channel = supabase.channel(`realtime:${tableName}:filtered:${filterString}`);

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
    .subscribe();

  return {
    unsubscribe: () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    }
  };
}

// Collection-specific subscriptions
export function subscribeToCollection(
  collectionId: string,
  callback: (payload: RealtimePostgresChangesPayload<any>) => void,
  event?: RealtimeEvent
): Unsubscribable {
  return subscribeToFilteredChanges(
    'collections',
    { id: collectionId },
    callback,
    event
  );
}

export function subscribeToCollectionProducts(
  collectionId: string,
  callback: (payload: RealtimePostgresChangesPayload<any>) => void,
  event?: RealtimeEvent
): Unsubscribable {
  return subscribeToFilteredChanges(
    'collection_products',
    { collection_id: collectionId },
    callback,
    event
  );
}

export function subscribeToCollectionCategories(
  collectionId: string,
  callback: (payload: RealtimePostgresChangesPayload<any>) => void,
  event?: RealtimeEvent
): Unsubscribable {
  return subscribeToFilteredChanges(
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