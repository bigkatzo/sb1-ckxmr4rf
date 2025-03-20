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
 * Subscribe to changes on a shared table with filtering
 */
export function subscribeToSharedTableChanges<T extends DatabaseChanges>(
  tableName: string,
  filter: { [key: string]: any },
  callback: (payload: RealtimePostgresChangesPayload<T>) => void,
  event: RealtimeEvent = '*'
): Unsubscribable {
  const unsubscribe = subscribeToFilteredChanges(tableName, filter, callback, event);
  return unsubscribe;
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