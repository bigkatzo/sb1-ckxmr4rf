import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';

// Track active channel instances to prevent duplicates
const activeChannels = new Map<string, {
  channel: RealtimeChannel;
  lastActivity: number;
  subscribers: number;
}>();

// Global health check to monitor Supabase realtime connection
let healthCheckInterval: any = null;
let isRealtimeHealthy = true;
let heartbeatInterval: any = null;
let isReconnecting = false;

// Start global health monitoring
function startHealthCheck() {
  if (healthCheckInterval) return;
  
  // Set up heartbeat to keep connections alive
  if (!heartbeatInterval) {
    heartbeatInterval = setInterval(() => {
      try {
        // Access the realtime client
        const realtimeClient = (supabase.realtime as any);
        if (realtimeClient?.transport?.connectionState === 'open') {
          // Send a ping message to keep connection alive
          realtimeClient.send({
            topic: 'phoenix',
            event: 'heartbeat',
            payload: {},
            ref: Date.now().toString()
          });
        }
      } catch (err) {
        console.error('Error sending heartbeat:', err);
      }
    }, 29000); // Just under 30 seconds (common idle timeout)
  }
  
  healthCheckInterval = setInterval(() => {
    try {
      const transport = (supabase.realtime as any)?.transport;
      const wasHealthy = isRealtimeHealthy;
      
      if (!transport) {
        isRealtimeHealthy = false;
      } else {
        isRealtimeHealthy = transport.connectionState === 'open';
      }
      
      // If health status changed, log it
      if (wasHealthy !== isRealtimeHealthy) {
        console.log(`Realtime connection health changed: ${isRealtimeHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
        
        // If we recovered, trigger global recovery
        if (isRealtimeHealthy && !wasHealthy) {
          console.log('Connection recovered, reconnecting all channels');
          // Wait a bit before reconnecting all channels
          setTimeout(reconnectAllChannels, 2000);
        }
        // If we lost connection, try a global reconnect
        else if (!isRealtimeHealthy && wasHealthy && !isReconnecting) {
          console.log('Connection lost, attempting global reconnect');
          triggerGlobalReconnect();
        }
      }
    } catch (err) {
      console.error('Error checking realtime health:', err);
      isRealtimeHealthy = false;
    }
  }, 15000);
}

// Force a global reconnect of the Supabase realtime client
async function triggerGlobalReconnect() {
  if (isReconnecting) return;
  
  try {
    isReconnecting = true;
    console.log('Triggering global reconnect of Supabase realtime client');
    
    const realtimeClient = (supabase.realtime as any);
    if (realtimeClient?.disconnect) {
      // Disconnect the client
      await realtimeClient.disconnect();
      
      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to reconnect
      if (realtimeClient?.connect) {
        await realtimeClient.connect();
        
        // Wait a bit more for the connection to establish
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if we're healthy now
        const transport = realtimeClient?.transport;
        isRealtimeHealthy = transport && transport.connectionState === 'open';
        
        if (isRealtimeHealthy) {
          console.log('Global reconnect successful');
          setTimeout(reconnectAllChannels, 1000);
        } else {
          console.error('Global reconnect failed');
        }
      }
    }
  } catch (err) {
    console.error('Error during global reconnect:', err);
  } finally {
    isReconnecting = false;
  }
}

// Force reconnect all channels
function reconnectAllChannels() {
  // Create a copy of the channel names to avoid issues with iterating while modifying
  const channelNames = Array.from(activeChannels.keys());
  
  // Group channel reconnections to avoid overloading
  const batchSize = 3;
  const reconnectBatch = async (startIdx: number) => {
    for (let i = startIdx; i < Math.min(startIdx + batchSize, channelNames.length); i++) {
      const channelName = channelNames[i];
      try {
        const channelInfo = activeChannels.get(channelName);
        if (channelInfo) {
          console.log(`Global reconnect for channel: ${channelName}`);
          channelInfo.channel.unsubscribe();
          
          // Re-create the channel with original name, using the base name without retry suffixes
          const baseName = channelName.split('_retry_')[0];
          const newChannel = supabase.channel(baseName, { 
            config: { broadcast: { self: true } }
          });
          
          // Update in our map
          activeChannels.set(channelName, {
            ...channelInfo,
            channel: newChannel,
            lastActivity: Date.now()
          });
        }
      } catch (err) {
        console.error(`Error during global reconnect for ${channelName}:`, err);
      }
    }
    
    // Process next batch after a delay
    if (startIdx + batchSize < channelNames.length) {
      setTimeout(() => reconnectBatch(startIdx + batchSize), 1000);
    }
  };
  
  // Start the batch process
  if (channelNames.length > 0) {
    reconnectBatch(0);
  }
}

// Cleanup and stop all monitoring
export function cleanupRealtimeMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Start health monitoring when this module is imported
startHealthCheck();

/**
 * Creates a robust channel with standardized reconnection logic
 * 
 * @param channelName - The base name for the channel
 * @param config - Channel configuration
 * @param maxReconnectAttempts - Max number of reconnection attempts before fallback
 */
export function createRobustChannel<T = any>(
  channelName: string,
  config: Record<string, any> = { broadcast: { self: true } },
  maxReconnectAttempts = 5
): { 
  channel: RealtimeChannel; 
  subscribe: (callback?: (data: T) => void) => { unsubscribe: () => void };
} {
  // Normalize channel name (remove any retry suffixes)
  const baseName = channelName.split('_retry_')[0];
  
  // First check if we already have this channel by base name
  let existingChannel: { 
    channel: RealtimeChannel; 
    lastActivity: number; 
    subscribers: number 
  } | undefined;
  
  // Look for any channel with the same base name
  for (const [key, value] of activeChannels.entries()) {
    if (key === baseName || key.startsWith(`${baseName}_retry_`)) {
      existingChannel = value;
      break;
    }
  }
  
  // Use existing channel if available, or create a new one
  let channel: RealtimeChannel;
  
  if (existingChannel) {
    channel = existingChannel.channel;
    existingChannel.subscribers++;
    existingChannel.lastActivity = Date.now();
    console.log(`Reusing existing channel: ${baseName} (${existingChannel.subscribers} subscribers)`);
  } else {
    // Create new channel with base name
    channel = supabase.channel(baseName, { config });
    activeChannels.set(baseName, {
      channel,
      lastActivity: Date.now(),
      subscribers: 1
    });
    console.log(`Created new channel: ${baseName}`);
  }
  
  let reconnectAttempts = 0;
  let reconnectTimer: any = null;
  let isSubscribed = false;
  let currentCallback: ((data: T) => void) | undefined = undefined;
  
  // Add subscription wrapper with reconnection logic
  const subscribe = (callback?: (data: T) => void) => {
    currentCallback = callback;
    let subscription: RealtimeChannel;
    
    const wrappedSubscribe = () => {
      try {
        subscription = channel.subscribe((status) => {
          console.log(`Channel status for ${baseName}: ${status}`);
          
          if (status === 'SUBSCRIBED') {
            // Reset reconnect attempts on successful connection
            reconnectAttempts = 0;
            isSubscribed = true;
            
            if (callback) callback({ status, connected: true } as any);
          } 
          else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            isSubscribed = false;
            console.warn(`Subscription closed or error for ${baseName}, reconnecting... (attempt ${reconnectAttempts+1}/${maxReconnectAttempts})`);
            
            // Only attempt to reconnect if under the maximum attempts
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              
              // Clear any existing timer
              if (reconnectTimer) clearTimeout(reconnectTimer);
              
              // Exponential backoff for reconnection
              const delay = 2000 * Math.pow(1.5, reconnectAttempts);
              reconnectTimer = setTimeout(() => {
                try {
                  // Don't create new channel instances, just retry the existing one
                  if (isRealtimeHealthy) {
                    try {
                      // Safely unsubscribe
                      subscription.unsubscribe();
                    } catch (err) {
                      // Ignore unsubscribe errors
                    }
                    
                    // Just try resubscribing to the same channel
                    wrappedSubscribe();
                  } else {
                    // Global connection issue, wait for health check to recover
                    console.log(`Not reconnecting ${baseName} due to unhealthy connection. Will retry when connection is restored.`);
                    
                    // Still callback to enable fallback behaviors
                    if (reconnectAttempts >= maxReconnectAttempts && callback) {
                      callback({ 
                        status: 'MAX_RETRIES_EXCEEDED', 
                        connected: false 
                      } as any);
                    }
                  }
                } catch (err) {
                  console.error(`Error reconnecting channel ${baseName}:`, err);
                  
                  // If we hit an error during reconnection, increment attempts and try again
                  if (reconnectAttempts < maxReconnectAttempts) {
                    setTimeout(() => wrappedSubscribe(), delay);
                  } else {
                    if (callback) callback({ 
                      status: 'MAX_RETRIES_EXCEEDED', 
                      connected: false,
                      error: String(err)
                    } as any);
                  }
                }
              }, delay);
            } else {
              console.error(`Maximum reconnection attempts (${maxReconnectAttempts}) reached for ${baseName}`);
              if (callback) callback({ 
                status: 'MAX_RETRIES_EXCEEDED', 
                connected: false 
              } as any);
            }
          }
        });
      } catch (err) {
        console.error(`Error subscribing to ${baseName}:`, err);
        if (callback) callback({ 
          status: 'SUBSCRIPTION_ERROR', 
          connected: false,
          error: String(err)
        } as any);
      }
    };
    
    wrappedSubscribe();
    
    // Return a custom unsubscribe method that cleans up properly
    return {
      unsubscribe: () => {
        try {
          const channelInfo = activeChannels.get(baseName);
          
          if (channelInfo) {
            // Decrement subscribers count
            channelInfo.subscribers--;
            
            // If this was the last subscriber, clean up
            if (channelInfo.subscribers <= 0) {
              console.log(`Removing channel ${baseName} - no more subscribers`);
              try {
                channelInfo.channel.unsubscribe();
              } catch (err) {
                // Ignore unsubscribe errors
                console.warn(`Error unsubscribing from ${baseName}:`, err);
              }
              activeChannels.delete(baseName);
            } else {
              console.log(`Channel ${baseName} still has ${channelInfo.subscribers} subscribers`);
            }
          }
          
          // Clear any reconnect timers
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
          }
        } catch (err) {
          console.error(`Error unsubscribing from ${baseName}:`, err);
        }
      }
    };
  };
  
  return { channel, subscribe };
}

// Shared channel for specific tables
// This pattern reduces the number of connections by sharing a channel for a table
// and filtering based on IDs in the handler
const sharedChannels = new Map<string, RealtimeChannel>();

export function subscribeToSharedTableChanges<T = any>(
  table: string,
  filter: Record<string, any>,
  onChanges: (payload: T) => void
): { unsubscribe: () => void } {
  const channelKey = `shared_${table}`;
  
  // Create or reuse a shared channel
  if (!sharedChannels.has(channelKey)) {
    sharedChannels.set(
      channelKey, 
      supabase.channel(channelKey, { config: { broadcast: { self: true } } })
    );
  }
  
  const channel = sharedChannels.get(channelKey)!;
  let isSubscribed = false;
  
  // Create unique event handler ID
  const handlerId = `${table}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Subscribe to postgres changes
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: table
    },
    (payload: any) => {
      // Check if filter matches payload
      let matches = true;
      for (const [key, value] of Object.entries(filter)) {
        if (payload.new && payload.new[key] !== value) {
          matches = false;
          break;
        }
      }
      
      // If matches, call the handler
      if (matches) {
        onChanges(payload as T);
      }
    }
  );
  
  // Subscribe once if not already subscribed
  if (!isSubscribed) {
    channel.subscribe((status) => {
      isSubscribed = status === 'SUBSCRIBED';
    });
  }
  
  // Return unsubscribe method
  return {
    unsubscribe: () => {
      // Remove just this handler, not the whole channel
      try {
        // Use removeChannel if off method is not available
        const realtimeClient = (supabase.realtime as any);
        if (realtimeClient?.removeChannel) {
          realtimeClient.removeChannel(channel);
        } else {
          // Fallback to unsubscribe
          channel.unsubscribe();
        }
      } catch (err) {
        console.error(`Error removing handler for ${table}:`, err);
      }
    }
  };
}

export function subscribeToCollection(
  collectionId: string,
  onUpdate: () => void
): { unsubscribe: () => void } {
  return subscribeToSharedTableChanges(
    'collections',
    { id: collectionId },
    () => {
      console.log('Collection updated:', collectionId);
      onUpdate();
    }
  );
}

export function subscribeToCollectionProducts(
  collectionId: string,
  onUpdate: () => void
): { unsubscribe: () => void } {
  return subscribeToSharedTableChanges(
    'products',
    { collection_id: collectionId },
    () => {
      console.log('Collection products updated:', collectionId);
      onUpdate();
    }
  );
}

export function subscribeToCollectionCategories(
  collectionId: string,
  onUpdate: () => void
): { unsubscribe: () => void } {
  return subscribeToSharedTableChanges(
    'categories',
    { collection_id: collectionId },
    () => {
      console.log('Collection categories updated:', collectionId);
      onUpdate();
    }
  );
}