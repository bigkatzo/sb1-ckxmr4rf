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
let isInitialConnectionEstablished = false;
let connectionInitAttempts = 0;
let heartbeatInterval: any = null;
let isReconnecting = false;
let lastConnectionAttempt = 0;

// Check initial connection health and try to establish connection
async function checkInitialConnectionHealth(): Promise<boolean> {
  if (isInitialConnectionEstablished) return isRealtimeHealthy;
  
  try {
    const realtimeClient = (supabase.realtime as any);
    if (!realtimeClient) {
      console.warn('Realtime client not available for initial connection check');
      return false;
    }
    
    // If we already have a transport that's open, we're good
    if (realtimeClient.transport?.connectionState === 'open') {
      isInitialConnectionEstablished = true;
      isRealtimeHealthy = true;
      return true;
    }
    
    // Avoid too frequent connection attempts
    const now = Date.now();
    if (now - lastConnectionAttempt < 5000 && connectionInitAttempts > 0) {
      return false;
    }
    
    // Try to establish connection if not already connected
    if (!realtimeClient.transport || realtimeClient.transport.connectionState !== 'open') {
      lastConnectionAttempt = now;
      connectionInitAttempts++;
      
      console.log(`Attempting to establish initial realtime connection (attempt ${connectionInitAttempts})`);
      
      if (typeof realtimeClient.connect === 'function') {
        await realtimeClient.connect();
        
        // Wait for connection to establish
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if connection succeeded
        if (realtimeClient.transport?.connectionState === 'open') {
          console.log('Successfully established initial realtime connection');
          isInitialConnectionEstablished = true;
          isRealtimeHealthy = true;
          return true;
        } else {
          console.warn(`Failed to establish initial connection, transport state: ${realtimeClient.transport?.connectionState || 'none'}`);
          return false;
        }
      }
    }
    
    return false;
  } catch (err) {
    console.error('Error establishing initial realtime connection:', err);
    return false;
  }
}

// Start global health monitoring
function startHealthCheck() {
  if (healthCheckInterval) return;
  
  // Try to establish initial connection
  checkInitialConnectionHealth().then(success => {
    if (success) {
      console.log('Initial realtime connection established successfully');
    } else {
      console.warn('Could not establish initial realtime connection, will keep trying');
    }
  });
  
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
  
  healthCheckInterval = setInterval(async () => {
    try {
      // If we're not established yet, try to establish the initial connection
      if (!isInitialConnectionEstablished) {
        const success = await checkInitialConnectionHealth();
        if (success) {
          console.log('Realtime connection established during health check');
        }
      }
      
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

// Export a function to check if realtime is healthy
export function isRealtimeConnectionHealthy(): boolean {
  return isRealtimeHealthy && isInitialConnectionEstablished;
}

// Force a global reconnect of the Supabase realtime client
async function triggerGlobalReconnect() {
  if (isReconnecting) return;
  
  try {
    isReconnecting = true;
    console.log('Triggering global reconnect of Supabase realtime client');
    
    const realtimeClient = (supabase.realtime as any);
    if (!realtimeClient) {
      console.error('Realtime client not available for reconnection');
      isRealtimeHealthy = false;
      isReconnecting = false;
      return;
    }
    
    // Safety check for transport
    if (!realtimeClient.transport) {
      console.warn('Realtime transport not available, attempting to initialize it');
      
      // Try to initialize a new connection
      try {
        if (typeof realtimeClient.connect === 'function') {
          await realtimeClient.connect();
          
          // Wait a bit for the connection to establish
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check if we got a transport now
          if (!realtimeClient.transport) {
            console.error('Failed to initialize realtime transport');
            isRealtimeHealthy = false;
            isReconnecting = false;
            return;
          }
        } else {
          // No connect method, can't reconnect
          console.error('No connect method available on realtime client');
          isRealtimeHealthy = false;
          isReconnecting = false;
          return;
        }
      } catch (err) {
        console.error('Error initializing realtime connection:', err);
        isRealtimeHealthy = false;
        isReconnecting = false;
        return;
      }
    }
    
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
          console.error('Global reconnect failed, falling back to polling');
          // Mark all channels for polling fallback
          activeChannels.forEach((info, name) => {
            console.log(`Channel ${name} will use polling fallback after failed reconnect`);
          });
        }
      }
    }
  } catch (err) {
    console.error('Error during global reconnect:', err);
    isRealtimeHealthy = false;
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
  
  // Add subscription wrapper with reconnection logic
  const subscribe = (callback?: (data: T) => void) => {
    let subscription: RealtimeChannel;
    
    const wrappedSubscribe = () => {
      try {
        subscription = channel.subscribe((status) => {
          console.log(`Channel status for ${baseName}: ${status}`);
          
          if (status === 'SUBSCRIBED') {
            // Reset reconnect attempts on successful connection
            reconnectAttempts = 0;
            
            if (callback) callback({ status, connected: true } as any);
          } 
          else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
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
const sharedChannels = new Map<string, {
  channel: RealtimeChannel;
  isSubscribed: boolean;
  subscribing: boolean;
  handlers: Set<string>;
}>();

/**
 * Debug utility for Supabase realtime connections
 */
export function setupRealtimeDebugger() {
  if (typeof window !== 'undefined') {
    // Attach debugger to window
    (window as any).debugRealtime = function(autoFix = false) {
      try {
        console.log('==== Supabase Realtime Debug Info ====');
        
        // Get realtime client
        const realtimeClient = (supabase.realtime as any);
        if (!realtimeClient) {
          console.error('Realtime client not available');
          return;
        }
        
        // Check WebSocket connection
        const transport = realtimeClient.transport;
        const connectionState = transport?.connectionState || 'unknown';
        console.log(`Connection state: ${connectionState}`);
        
        // Check active channels
        const activeChannelCount = activeChannels.size;
        console.log(`Active channels: ${activeChannelCount}`);
        activeChannels.forEach((info, name) => {
          console.log(`- ${name}: ${info.subscribers} subscribers`);
        });
        
        // Check shared channels
        const sharedChannelCount = sharedChannels.size;
        console.log(`Shared channels: ${sharedChannelCount}`);
        sharedChannels.forEach((info, name) => {
          console.log(`- ${name}: ${info.handlers.size} handlers, subscribed: ${info.isSubscribed}`);
        });
        
        // Overall health status
        console.log(`Global health status: ${isRealtimeHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
        
        // Try to get official Supabase channels
        let supabaseChannels: any[] = [];
        if (realtimeClient.getChannels) {
          supabaseChannels = realtimeClient.getChannels();
          console.log(`Supabase reports ${supabaseChannels.length} channels`);
          
          // List all channels
          supabaseChannels.forEach((channel: any) => {
            console.log(`- ${channel.topic} (${channel.state})`);
          });
        }
        
        // Auto-fix functionality
        if (autoFix) {
          console.log('Attempting automatic fixes...');
          
          // Disconnect and reconnect if connection is unhealthy
          if (!isRealtimeHealthy) {
            console.log('Connection is unhealthy, triggering global reconnect');
            triggerGlobalReconnect();
          }
          
          // Clean up any duplicate or stale channels
          if (supabaseChannels.length > 0) {
            const closedOrErrorChannels = supabaseChannels.filter(
              (channel: any) => channel.state === 'closed' || channel.state === 'errored'
            );
            
            if (closedOrErrorChannels.length > 0) {
              console.log(`Cleaning up ${closedOrErrorChannels.length} closed/errored channels`);
              closedOrErrorChannels.forEach((channel: any) => {
                try {
                  console.log(`Unsubscribing from ${channel.topic}`);
                  channel.unsubscribe();
                } catch (err) {
                  console.error(`Failed to unsubscribe from ${channel.topic}:`, err);
                }
              });
            }
          }
        }
        
        // Expose cleanup method
        (window as any).debugRealtime.cleanupSubscriptions = function() {
          try {
            console.log('Cleaning up all subscriptions...');
            
            // Clean up all channels from our tracking
            console.log(`Cleaning ${activeChannels.size} active channels`);
            activeChannels.forEach((info, name) => {
              try {
                info.channel.unsubscribe();
              } catch (err) {
                console.warn(`Error unsubscribing from ${name}:`, err);
              }
            });
            activeChannels.clear();
            
            // Clean up shared channels
            console.log(`Cleaning ${sharedChannels.size} shared channels`);
            sharedChannels.forEach((info, name) => {
              try {
                info.channel.unsubscribe();
              } catch (err) {
                console.warn(`Error unsubscribing from ${name}:`, err);
              }
            });
            sharedChannels.clear();
            
            // Try to clean up Supabase's internal channels
            const realtimeClient = (supabase.realtime as any);
            if (realtimeClient?.getChannels) {
              const channels = realtimeClient.getChannels();
              console.log(`Cleaning ${channels.length} Supabase internal channels`);
              
              channels.forEach((channel: any) => {
                try {
                  channel.unsubscribe();
                } catch (err) {
                  console.warn(`Error unsubscribing from ${channel.topic}:`, err);
                }
              });
            }
            
            console.log('Cleanup complete. Recommend page refresh.');
            return true;
          } catch (err) {
            console.error('Error during cleanup:', err);
            return false;
          }
        };
        
        return 'Debug complete. Run window.debugRealtime(true) to attempt automatic fixes.';
      } catch (err) {
        console.error('Error in realtime debugger:', err);
        return false;
      }
    };
    
    console.log('Realtime debugger exposed. Run window.debugRealtime() to debug realtime connections.');
    console.log('Run window.debugRealtime(true) to attempt automatic fixes.');
    console.log('Run window.debugRealtime.cleanupSubscriptions() to clean up stale subscriptions.');
  }
}

// Initialize debugger
setupRealtimeDebugger();

export function subscribeToSharedTableChanges<T = any>(
  table: string,
  filter: Record<string, any>,
  onChanges: (payload: T) => void
): { unsubscribe: () => void } {
  const channelKey = `shared_${table}`;
  
  // Create unique handler ID
  const handlerId = `${table}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Create or reuse a shared channel
  if (!sharedChannels.has(channelKey)) {
    sharedChannels.set(
      channelKey, 
      {
        channel: supabase.channel(channelKey, { config: { broadcast: { self: true } } }),
        isSubscribed: false,
        subscribing: false,
        handlers: new Set([handlerId])
      }
    );
  } else {
    // Add handler to existing channel
    const existing = sharedChannels.get(channelKey)!;
    existing.handlers.add(handlerId);
  }
  
  const channelInfo = sharedChannels.get(channelKey)!;
  const channel = channelInfo.channel;
  
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
  
  // Subscribe once if not already subscribed and not in the process of subscribing
  if (!channelInfo.isSubscribed && !channelInfo.subscribing) {
    try {
      // Mark as subscribing to prevent concurrent subscribe calls
      channelInfo.subscribing = true;
      
      channel.subscribe((status) => {
        channelInfo.subscribing = false;
        channelInfo.isSubscribed = status === 'SUBSCRIBED';
        
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn(`Shared channel ${channelKey} closed or errored, will resubscribe on next use`);
          channelInfo.isSubscribed = false;
          
          // Try to resubscribe once after a short delay
          setTimeout(() => {
            try {
              if (sharedChannels.has(channelKey) && !sharedChannels.get(channelKey)!.isSubscribed) {
                const currentInfo = sharedChannels.get(channelKey)!;
                if (!currentInfo.subscribing) {
                  console.log(`Attempting to resubscribe to ${channelKey} after closure`);
                  currentInfo.subscribing = true;
                  
                  // Try to resubscribe
                  currentInfo.channel.subscribe((resubStatus) => {
                    currentInfo.subscribing = false;
                    currentInfo.isSubscribed = resubStatus === 'SUBSCRIBED';
                    
                    if (resubStatus !== 'SUBSCRIBED') {
                      console.warn(`Failed to resubscribe to ${channelKey}, will keep using polling`);
                    } else {
                      console.log(`Successfully resubscribed to ${channelKey}`);
                    }
                  });
                }
              }
            } catch (err) {
              console.error(`Error resubscribing to ${channelKey}:`, err);
              const info = sharedChannels.get(channelKey);
              if (info) {
                info.subscribing = false;
              }
            }
          }, 3000);
        }
      });
    } catch (err) {
      console.error(`Error subscribing to shared channel ${channelKey}:`, err);
      channelInfo.subscribing = false;
    }
  }
  
  // Return unsubscribe method
  return {
    unsubscribe: () => {
      // Remove handler from set
      const channelInfo = sharedChannels.get(channelKey);
      if (channelInfo) {
        channelInfo.handlers.delete(handlerId);
        
        // If no more handlers, unsubscribe and remove channel
        if (channelInfo.handlers.size === 0) {
          try {
            channelInfo.channel.unsubscribe();
          } catch (err) {
            console.warn(`Error unsubscribing from shared channel ${channelKey}:`, err);
          }
          sharedChannels.delete(channelKey);
        }
      }
    }
  };
}

// Create a simple polling implementation for collections when realtime is unavailable
function createPollingFallback(
  collectionId: string,
  table: string,
  filter: Record<string, any>,
  onUpdate: () => void
): { unsubscribe: () => void } {
  console.log(`Using polling for ${collectionId} (${activeChannels.size} active subscriptions)`);
  
  // Set up polling interval
  const POLL_INTERVAL = 10000; // 10 seconds
  const intervalId = setInterval(() => {
    // Call the handler to refresh data
    onUpdate();
  }, POLL_INTERVAL);
  
  // Return cleanup function
  return {
    unsubscribe: () => {
      console.log(`Stopping polling for ${collectionId}`);
      clearInterval(intervalId);
    }
  };
}

export function subscribeToCollectionProducts(
  collectionId: string,
  onUpdate: () => void
): { unsubscribe: () => void } {
  // First check if realtime is available
  const isHealthy = isRealtimeConnectionHealthy();
  if (!isHealthy) {
    console.log(`Connection unhealthy for ${collectionId}, switching to polling immediately`);
    return createPollingFallback(collectionId, 'products', { collection_id: collectionId }, onUpdate);
  }
  
  // If realtime is healthy, proceed with subscription
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
  // First check if realtime is available
  const isHealthy = isRealtimeConnectionHealthy();
  if (!isHealthy) {
    console.log(`Connection unhealthy for ${collectionId}, switching to polling immediately`);
    return createPollingFallback(collectionId, 'categories', { collection_id: collectionId }, onUpdate);
  }
  
  // If realtime is healthy, proceed with subscription
  return subscribeToSharedTableChanges(
    'categories',
    { collection_id: collectionId },
    () => {
      console.log('Collection categories updated:', collectionId);
      onUpdate();
    }
  );
}

// Update the collection subscription to use the polling fallback
export function subscribeToCollection(
  collectionId: string,
  onUpdate: () => void
): { unsubscribe: () => void } {
  // First check if realtime is available
  const isHealthy = isRealtimeConnectionHealthy();
  if (!isHealthy) {
    console.log(`Connection unhealthy for ${collectionId}, switching to polling immediately`);
    return createPollingFallback(collectionId, 'collections', { id: collectionId }, onUpdate);
  }
  
  // If realtime is healthy, proceed with subscription
  return subscribeToSharedTableChanges(
    'collections',
    { id: collectionId },
    () => {
      console.log('Collection updated:', collectionId);
      onUpdate();
    }
  );
}