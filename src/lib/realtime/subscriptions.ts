import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';

/**
 * Creates a robust channel with standardized reconnection logic
 */
export function createRobustChannel<T = any>(
  channelName: string,
  config: Record<string, any> = { broadcast: { self: true } },
  maxReconnectAttempts = 5
): { 
  channel: RealtimeChannel; 
  subscribe: (callback?: (data: T) => void) => RealtimeChannel;
} {
  let reconnectAttempts = 0;
  let reconnectTimer: any = null;
  
  // Create channel with the given name and config
  const channel = supabase.channel(channelName, { config });
  
  // Add subscription wrapper with reconnection logic
  const subscribe = (callback?: (data: T) => void) => {
    const wrappedSubscribe = () => {
      return channel.subscribe((status) => {
        console.log(`Channel status for ${channelName}: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          // Reset reconnect attempts on successful connection
          reconnectAttempts = 0;
          if (callback) callback({ status, connected: true } as any);
        } 
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn(`Subscription closed or error for ${channelName}, reconnecting... (attempt ${reconnectAttempts+1}/${maxReconnectAttempts})`);
          
          // Only attempt to reconnect if under the maximum attempts
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            
            // Clear any existing timer
            if (reconnectTimer) clearTimeout(reconnectTimer);
            
            // Exponential backoff for reconnection
            const delay = 2000 * Math.pow(1.5, reconnectAttempts);
            reconnectTimer = setTimeout(() => {
              // Unsubscribe and resubscribe
              channel.unsubscribe();
              wrappedSubscribe();
            }, delay);
          } else {
            console.error(`Maximum reconnection attempts (${maxReconnectAttempts}) reached for ${channelName}`);
            if (callback) callback({ status: 'MAX_RETRIES_EXCEEDED', connected: false } as any);
          }
        }
      });
    };
    
    return wrappedSubscribe();
  };
  
  return { channel, subscribe };
}

export function subscribeToCollection(
  collectionId: string,
  onUpdate: () => void
): RealtimeChannel {
  return supabase
    .channel(`collection:${collectionId}`)
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'collections', 
        filter: `id=eq.${collectionId}` 
      },
      () => {
        console.log('Collection updated:', collectionId);
        onUpdate();
      }
    )
    .subscribe();
}

export function subscribeToCollectionProducts(
  collectionId: string,
  onUpdate: () => void
): RealtimeChannel {
  return supabase
    .channel(`collection_products:${collectionId}`)
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'products', 
        filter: `collection_id=eq.${collectionId}` 
      },
      () => {
        console.log('Collection products updated:', collectionId);
        onUpdate();
      }
    )
    .subscribe();
}

export function subscribeToCollectionCategories(
  collectionId: string,
  onUpdate: () => void
): RealtimeChannel {
  return supabase
    .channel(`collection_categories:${collectionId}`)
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'categories', 
        filter: `collection_id=eq.${collectionId}` 
      },
      () => {
        console.log('Collection categories updated:', collectionId);
        onUpdate();
      }
    )
    .subscribe();
}