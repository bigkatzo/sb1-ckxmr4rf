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
let realtimeGivenUp = false;  // Flag to track if we've given up on realtime completely

// Add a tracking set for collections already being polled to reduce duplicate logs
const pollingCollections = new Set<string>();

// Add a maximum limit for connection attempts
const MAX_CONNECTION_ATTEMPTS = 10;
const CONNECTION_ATTEMPT_BACKOFF = 5000; // Base backoff time in ms

// Add a counter for resubscription attempts per channel
const channelResubscribeAttempts = new Map<string, number>();
const MAX_CHANNEL_RESUBSCRIBE_ATTEMPTS = 5;
const CHANNEL_RESUBSCRIBE_RESET_INTERVAL = 120000; // 2 minutes
const CHANNEL_RESUBSCRIBE_DELAY = 3000; // 3 seconds

// Add a log rate limiter to reduce console noise
const logRateLimiter = new Map<string, number>();
const LOG_RATE_LIMIT_INTERVAL = 10000; // 10 seconds

// Helper to calculate exponential backoff with jitter
function calculateBackoff(attempt: number, baseDelay: number = CONNECTION_ATTEMPT_BACKOFF): number {
  // Exponential backoff: baseDelay * 2^attempt
  const expBackoff = baseDelay * Math.pow(2, attempt); 
  // Add jitter: random value between 0.5 and 1.5 of the backoff
  const jitter = 0.5 + Math.random();
  return Math.min(expBackoff * jitter, 60000); // Cap at 60 seconds
}

// Rate-limited console logging function
function rateLog(key: string, level: 'log' | 'warn' | 'error', message: string) {
  const now = Date.now();
  const lastLogTime = logRateLimiter.get(key) || 0;
  
  // If we've logged this message recently, don't log again
  if (now - lastLogTime < LOG_RATE_LIMIT_INTERVAL) {
    return;
  }
  
  // Update last log time
  logRateLimiter.set(key, now);
  
  // Log with appropriate level
  if (level === 'warn') {
    console.warn(message);
  } else if (level === 'error') {
    console.error(message);
  } else {
    console.log(message);
  }
}

// Check initial connection health and try to establish connection
async function checkInitialConnectionHealth(): Promise<boolean> {
  if (isInitialConnectionEstablished) return isRealtimeHealthy;
  
  try {
    const realtimeClient = (supabase.realtime as any);
    if (!realtimeClient) {
      rateLog(
        'realtime_client_unavailable',
        'warn',
        'Realtime client not available for initial connection check'
      );
      return false;
    }
    
    // If we already have a transport that's open, we're good
    if (realtimeClient.transport?.connectionState === 'open') {
      isInitialConnectionEstablished = true;
      isRealtimeHealthy = true;
      return true;
    }
    
    // Check if we've exceeded the maximum number of attempts
    if (connectionInitAttempts >= MAX_CONNECTION_ATTEMPTS) {
      rateLog(
        'max_connection_attempts',
        'log',
        `Maximum connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached. Giving up and falling back to polling.`
      );
      // Don't keep trying after max attempts
      return false;
    }
    
    // Avoid too frequent connection attempts with exponential backoff
    const now = Date.now();
    const backoffTime = calculateBackoff(connectionInitAttempts);
    if (now - lastConnectionAttempt < backoffTime && connectionInitAttempts > 0) {
      return false;
    }
    
    // Try to establish connection if not already connected
    if (!realtimeClient.transport || realtimeClient.transport.connectionState !== 'open') {
      lastConnectionAttempt = now;
      connectionInitAttempts++;
      
      rateLog(
        'connection_attempt',
        'log',
        `Attempting to establish initial realtime connection (attempt ${connectionInitAttempts}/${MAX_CONNECTION_ATTEMPTS})`
      );
      
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
          rateLog(
            'connection_failed',
            'warn',
            `Failed to establish initial connection, transport state: ${realtimeClient.transport?.connectionState || 'none'}`
          );
          
          // Add more details about next attempt
          if (connectionInitAttempts < MAX_CONNECTION_ATTEMPTS) {
            const nextBackoff = calculateBackoff(connectionInitAttempts);
            rateLog(
              'connection_retry_info',
              'log',
              `Will retry in approximately ${Math.round(nextBackoff/1000)} seconds (attempt ${connectionInitAttempts}/${MAX_CONNECTION_ATTEMPTS})`
            );
          } else {
            rateLog(
              'max_connection_attempts_reached',
              'log',
              `Maximum connection attempts reached. Will use polling for all subscriptions.`
            );
          }
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
      
      // Give up immediately if connection initialization fails and max attempts reached
      if (connectionInitAttempts >= MAX_CONNECTION_ATTEMPTS) {
        realtimeGivenUp = true;
        console.log('Initial connection attempts failed. All subscriptions will use polling.');
        
        // Notify existing collections to switch to polling
        switchAllToPolling();
      }
    }
  });
  
  // Set up heartbeat to keep connections alive - only if we haven't given up on realtime
  const setupHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    // Only set up heartbeat if we haven't given up on realtime
    if (!realtimeGivenUp) {
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
  };
  
  setupHeartbeat();
  
  healthCheckInterval = setInterval(async () => {
    try {
      // If we've given up on realtime, use a longer interval for checks
      if (realtimeGivenUp) {
        // Reduce the frequency of health checks when we've given up
        clearInterval(healthCheckInterval);
        healthCheckInterval = setInterval(async () => {
          rateLog(
            'periodic_check_reduced',
            'log',
            'Periodic check for realtime availability (reduced frequency)'
          );
          const transport = (supabase.realtime as any)?.transport;
          isRealtimeHealthy = transport && transport.connectionState === 'open';
          
          if (isRealtimeHealthy) {
            // Realtime is back! Reset the given up flag and restore normal interval
            realtimeGivenUp = false;
            console.log('Realtime appears to be available again, resuming normal operation');
            
            clearInterval(healthCheckInterval);
            startHealthCheck();
          }
        }, 60000); // Check once per minute instead
        return;
      }
      
      // If we're not established yet, try to establish the initial connection
      if (!isInitialConnectionEstablished && !realtimeGivenUp) {
        const success = await checkInitialConnectionHealth();
        if (success) {
          console.log('Realtime connection established during health check');
        } else if (connectionInitAttempts >= MAX_CONNECTION_ATTEMPTS) {
          // We've hit max attempts, give up on realtime
          realtimeGivenUp = true;
          console.log('Maximum connection attempts reached during health check. Switching to polling mode.');
          
          // Switch all active subscriptions to polling
          switchAllToPolling();
          
          // Switch to reduced frequency health checks
          clearInterval(healthCheckInterval);
          startHealthCheck();
          return;
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
          // Reset given up flag if we recover
          realtimeGivenUp = false;
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
  // If we've given up on realtime, always report as unhealthy
  if (realtimeGivenUp) {
    return false;
  }
  return isRealtimeHealthy && isInitialConnectionEstablished;
}

// Force a global reconnect of the Supabase realtime client
async function triggerGlobalReconnect() {
  if (isReconnecting) return;
  
  // Don't attempt reconnect if we've given up on realtime
  if (realtimeGivenUp) {
    console.log('Not attempting global reconnect - realtime system is in polling-only mode');
    return;
  }
  
  try {
    isReconnecting = true;
    console.log('Triggering global reconnect of Supabase realtime client');
    
    const realtimeClient = (supabase.realtime as any);
    if (!realtimeClient) {
      console.error('Realtime client not available for reconnection');
      isRealtimeHealthy = false;
      isReconnecting = false;
      
      // If we've tried max attempts, give up on realtime entirely
      if (connectionInitAttempts >= MAX_CONNECTION_ATTEMPTS) {
        realtimeGivenUp = true;
        console.log('Maximum connection attempts reached during reconnect. All subscriptions will use polling.');
      }
      return;
    }
    
    // Safety check for transport
    if (!realtimeClient.transport) {
      console.warn('Realtime transport not available, attempting to initialize it');
      
      // Try to initialize a new connection
      try {
        if (typeof realtimeClient.connect === 'function') {
          await Promise.race([
            realtimeClient.connect(),
            // Add a timeout to prevent hanging if connect never resolves
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Connection attempt timed out')), 5000)
            )
          ]);
          
          // Wait a bit for the connection to establish
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check if we got a transport now
          if (!realtimeClient.transport) {
            console.error('Failed to initialize realtime transport');
            isRealtimeHealthy = false;
            
            // Increment connection attempt counter
            connectionInitAttempts++;
            
            // If we've tried max attempts, give up on realtime entirely
            if (connectionInitAttempts >= MAX_CONNECTION_ATTEMPTS) {
              realtimeGivenUp = true;
              console.log('Maximum connection attempts reached during reconnect. All subscriptions will use polling.');
            }
            
            isReconnecting = false;
            return;
          }
        } else {
          // No connect method, can't reconnect
          console.error('No connect method available on realtime client');
          isRealtimeHealthy = false;
          isReconnecting = false;
          
          // If we've tried max attempts, give up on realtime entirely
          if (connectionInitAttempts >= MAX_CONNECTION_ATTEMPTS) {
            realtimeGivenUp = true;
            console.log('Maximum connection attempts reached during reconnect. All subscriptions will use polling.');
          }
          return;
        }
      } catch (err) {
        console.error('Error initializing realtime connection:', err);
        isRealtimeHealthy = false;
        
        // Increment connection attempt counter on failure
        connectionInitAttempts++;
        
        // If we've tried max attempts, give up on realtime entirely
        if (connectionInitAttempts >= MAX_CONNECTION_ATTEMPTS) {
          realtimeGivenUp = true;
          console.log('Maximum connection attempts reached during reconnect. All subscriptions will use polling.');
        }
        
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
            rateLog(
              `channel_polling_fallback_${name}`,
              'log',
              `Channel ${name} will use polling fallback after failed reconnect`
            );
            // Update last activity on the channel
            info.lastActivity = Date.now();
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
    let isCurrentlySubscribed = false;
    
    const wrappedSubscribe = () => {
      try {
        // Don't try to subscribe if already subscribed
        if (isCurrentlySubscribed) {
          console.warn(`Channel ${baseName} is already subscribed, skipping duplicate subscription`);
          return;
        }
        
        // Reset subscription state when making a new subscription attempt
        isCurrentlySubscribed = false;
        
        subscription = channel.subscribe((status) => {
          console.log(`Channel status for ${baseName}: ${status}`);
          
          if (status === 'SUBSCRIBED') {
            // Reset reconnect attempts on successful connection
            reconnectAttempts = 0;
            isCurrentlySubscribed = true;
            
            if (callback) callback({ status, connected: true } as any);
          } 
          else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.warn(`Subscription closed or error for ${baseName}, reconnecting... (attempt ${reconnectAttempts+1}/${maxReconnectAttempts})`);
            isCurrentlySubscribed = false;
            
            // Only attempt to reconnect if under the maximum attempts
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              
              // Clear any existing timer
              if (reconnectTimer) clearTimeout(reconnectTimer);
              
              // Exponential backoff for reconnection
              const delay = calculateBackoff(reconnectAttempts);
              reconnectTimer = setTimeout(() => {
                try {
                  // Don't create new channel instances, just retry the existing one
                  if (isRealtimeHealthy) {
                    try {
                      // Safely unsubscribe from the old channel
                      try {
                        subscription.unsubscribe();
                      } catch (err) {
                        // Ignore unsubscribe errors
                      }
                      
                      // Create a new channel instance with a unique name
                      const newChannelName = `${baseName}_retry_${reconnectAttempts}_${Date.now()}`;
                      console.log(`Creating new channel instance: ${newChannelName}`);
                      
                      const newChannel = supabase.channel(newChannelName, { config });
                      
                      // Update the channel reference in our tracking
                      const channelInfo = activeChannels.get(baseName);
                      if (channelInfo) {
                        channelInfo.channel = newChannel;
                        channelInfo.lastActivity = Date.now();
                      }
                      
                      // Update our local reference
                      channel = newChannel;
                      
                      // Try subscribing with the new channel
                      wrappedSubscribe();
                    } catch (err) {
                      console.error(`Error creating new channel for ${baseName}:`, err);
                    }
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

// Add this helper function to manage resubscription attempts
function trackResubscriptionAttempt(channelKey: string): boolean {
  // Get current attempt count
  const currentAttempts = channelResubscribeAttempts.get(channelKey) || 0;
  
  // Increment and store
  const newAttempts = currentAttempts + 1;
  channelResubscribeAttempts.set(channelKey, newAttempts);
  
  // Schedule cleanup
  if (newAttempts === 1) {
    setTimeout(() => {
      // Reset counter after interval
      channelResubscribeAttempts.delete(channelKey);
    }, CHANNEL_RESUBSCRIBE_RESET_INTERVAL);
  }
  
  // Return whether to continue with resubscription
  return newAttempts <= MAX_CHANNEL_RESUBSCRIBE_ATTEMPTS;
}

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
          rateLog(
            `${channelKey}_closed`,
            'warn',
            `Shared channel ${channelKey} closed or errored, will resubscribe on next use`
          );
          channelInfo.isSubscribed = false;
          
          // Try to resubscribe once after a short delay
          setTimeout(() => {
            try {
              if (sharedChannels.has(channelKey) && !sharedChannels.get(channelKey)!.isSubscribed) {
                const currentInfo = sharedChannels.get(channelKey)!;
                if (!currentInfo.subscribing) {
                  // Check if we've attempted too many resubscriptions
                  if (trackResubscriptionAttempt(channelKey)) {
                    rateLog(
                      `${channelKey}_resubscribe_attempt`,
                      'log',
                      `Attempting to resubscribe to ${channelKey} after closure (attempt ${channelResubscribeAttempts.get(channelKey)}/${MAX_CHANNEL_RESUBSCRIBE_ATTEMPTS})`
                    );
                    currentInfo.subscribing = true;
                    
                    // Create a new channel instance instead of reusing the existing one
                    const newChannel = supabase.channel(channelKey + '_reconnect_' + Date.now(), { 
                      config: { broadcast: { self: true } } 
                    });
                    
                    // Re-add all the event handlers from the original channel
                    // For postgres_changes handlers
                    const pgHandlers = (currentInfo.channel as any)._listeners?.postgres_changes || [];
                    for (const handler of pgHandlers) {
                      newChannel.on('postgres_changes', handler.filter, handler.callback);
                    }
                    
                    // Update channel reference
                    currentInfo.channel = newChannel;
                    
                    // Try to subscribe with the new channel
                    newChannel.subscribe((resubStatus) => {
                      currentInfo.subscribing = false;
                      currentInfo.isSubscribed = resubStatus === 'SUBSCRIBED';
                      
                      if (resubStatus !== 'SUBSCRIBED') {
                        rateLog(
                          `${channelKey}_resubscribe_failed`,
                          'warn',
                          `Failed to resubscribe to ${channelKey}, will keep using polling`
                        );
                      } else {
                        console.log(`Successfully resubscribed to ${channelKey}`);
                        // Reset the attempt counter on success
                        channelResubscribeAttempts.delete(channelKey);
                      }
                    });
                  } else {
                    rateLog(
                      `${channelKey}_resubscribe_max`,
                      'log',
                      `Maximum resubscription attempts for ${channelKey} reached, falling back to polling`
                    );
                    // Force all handlers to use polling by setting channel as permanently closed
                    currentInfo.isSubscribed = false;
                    currentInfo.subscribing = false;
                  }
                }
              }
            } catch (err) {
              console.error(`Error resubscribing to ${channelKey}:`, err);
              const info = sharedChannels.get(channelKey);
              if (info) {
                info.subscribing = false;
              }
            }
          }, CHANNEL_RESUBSCRIBE_DELAY);
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

// Update the polling logging to use rate limiting
function createPollingFallback(
  collectionId: string,
  table: string,
  _filter: Record<string, any>,
  onUpdate: () => void
): { unsubscribe: () => void } {
  // Check if we're already polling this collection
  const pollingKey = `${table}_${collectionId}`;
  
  if (pollingCollections.has(pollingKey)) {
    rateLog(
      `polling_reuse_${pollingKey}`, 
      'log',
      `Already polling ${table} for ${collectionId}, reusing existing polling`
    );
  } else {
    rateLog(
      `polling_start_${pollingKey}`,
      'log',
      `Using polling for ${collectionId} (${activeChannels.size} active subscriptions)`
    );
    pollingCollections.add(pollingKey);
  }
  
  // Set up polling interval
  const POLL_INTERVAL = 10000; // 10 seconds
  const intervalId = setInterval(() => {
    // Call the handler to refresh data
    onUpdate();
  }, POLL_INTERVAL);
  
  // Return cleanup function
  return {
    unsubscribe: () => {
      rateLog(
        `polling_stop_${pollingKey}`,
        'log',
        `Stopping polling for ${collectionId}`
      );
      clearInterval(intervalId);
      pollingCollections.delete(pollingKey);
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
    rateLog(
      `connection_unhealthy_${collectionId}_products`,
      'log',
      `Connection unhealthy for ${collectionId}, switching to polling immediately`
    );
    return createPollingFallback(collectionId, 'public_products', { collection_id: collectionId }, onUpdate);
  }
  
  // If realtime is healthy, proceed with subscription
  return subscribeToSharedTableChanges(
    'public_products',
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
    rateLog(
      `connection_unhealthy_${collectionId}_categories`,
      'log',
      `Connection unhealthy for ${collectionId}, switching to polling immediately`
    );
    return createPollingFallback(collectionId, 'public_categories', { collection_id: collectionId }, onUpdate);
  }
  
  // If realtime is healthy, proceed with subscription
  return subscribeToSharedTableChanges(
    'public_categories',
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
    rateLog(
      `connection_unhealthy_${collectionId}`,
      'log',
      `Connection unhealthy for ${collectionId}, switching to polling immediately`
    );
    return createPollingFallback(collectionId, 'public_collections', { id: collectionId }, onUpdate);
  }
  
  // If realtime is healthy, proceed with subscription
  return subscribeToSharedTableChanges(
    'public_collections',
    { id: collectionId },
    () => {
      console.log('Collection updated:', collectionId);
      onUpdate();
    }
  );
}

// Helper function to switch all active collections to polling
function switchAllToPolling() {
  console.log('Switching all collections to polling mode due to persistent connection issues');
  
  // Mark all shared channels as not subscribed to force polling on next use
  sharedChannels.forEach((info, key) => {
    info.isSubscribed = false;
    info.subscribing = false;
    rateLog(
      `force_polling_${key}`,
      'log',
      `Force switched ${key} to polling mode due to persistent connection issues`
    );
  });
}

// Start monitoring the health of the Supabase realtime connection
export function setupRealtimeHealth() {
  if (typeof window === 'undefined' || healthCheckInterval) return;
  
  // First attempt to establish initial connection
  setTimeout(() => {
    checkAndInitializeConnection();
  }, 2000);
  
  // Then set up regular health checks
  healthCheckInterval = setInterval(() => {
    checkConnectionHealth();
  }, 20000); // Check every 20 seconds
  
  // Add a heartbeat to keep WebSocket alive in some environments
  heartbeatInterval = setInterval(() => {
    if (isRealtimeHealthy) {
      sendHeartbeat();
    }
  }, 45000); // Every 45 seconds, send a heartbeat if connection is healthy
  
  // Add window focus listener to trigger reconnection when tab becomes active
  window.addEventListener('focus', () => {
    // If connection was unhealthy, try to reconnect when user returns to tab
    if (!isRealtimeHealthy && !isReconnecting) {
      rateLog('reconnect_on_focus', 'log', 'Window regained focus, attempting to reconnect to realtime');
      triggerGlobalReconnect();
    }
  });
}

// Function to check and initialize connection
async function checkAndInitializeConnection() {
  // Don't attempt if we've already given up
  if (realtimeGivenUp) return;
  
  // Check if a connection exists and is healthy
  const realtimeClient = (supabase.realtime as any);
  if (!realtimeClient) return;
  
  const transport = realtimeClient.transport;
  if (transport && transport.connectionState === 'open') {
    // Connection exists and is open
    isInitialConnectionEstablished = true;
    isRealtimeHealthy = true;
    return;
  }
  
  // No connection or not open, try to establish one
  if (!isReconnecting) {
    tryEstablishInitialConnection();
  }
}

// Function to check the health of the realtime connection
function checkConnectionHealth() {
  // Don't check if we've given up on realtime
  if (realtimeGivenUp) return;
  
  const realtimeClient = (supabase.realtime as any);
  if (!realtimeClient) {
    isRealtimeHealthy = false;
    return;
  }
  
  const transport = realtimeClient.transport;
  const connectionState = transport?.connectionState;
  
  // If connection state is open, mark as healthy
  if (connectionState === 'open') {
    if (!isRealtimeHealthy) {
      rateLog('connection_status_change', 'log', 'Realtime connection health changed: HEALTHY');
    }
    isRealtimeHealthy = true;
    return;
  }
  
  // Connection is not open, mark as unhealthy
  if (isRealtimeHealthy) {
    rateLog('connection_status_change', 'log', 'Realtime connection health changed: UNHEALTHY');
    rateLog('connection_lost', 'warn', 'Connection lost, attempting global reconnect');
    isRealtimeHealthy = false;
    
    // Attempt to reconnect
    triggerGlobalReconnect();
  }
}

// Send a lightweight heartbeat through an existing channel to keep connection alive
function sendHeartbeat() {
  try {
    const realtimeClient = (supabase.realtime as any);
    if (!realtimeClient || !realtimeClient.transport || realtimeClient.transport.connectionState !== 'open') {
      return;
    }
    
    // Find any active channel to use for heartbeat
    const channels = supabase.getChannels();
    if (channels.length > 0) {
      // Just use first channel for heartbeat
      const channel = channels[0];
      if (channel && channel.state === 'joined') {
        // Use the presence API to send a lightweight heartbeat
        if (typeof channel.send === 'function') {
          channel.send({
            type: 'presence',
            event: 'heartbeat',
            payload: {}
          });
        }
      }
    }
  } catch (err) {
    // Ignore heartbeat errors
  }
}

// Function to try establishing initial realtime connection
async function tryEstablishInitialConnection() {
  // Don't attempt if we're already reconnecting, have given up, or reached max attempts
  if (isReconnecting || realtimeGivenUp || connectionInitAttempts >= MAX_CONNECTION_ATTEMPTS) {
    return;
  }
  
  // Mark last attempt time
  lastConnectionAttempt = Date.now();
  connectionInitAttempts++;
  
  try {
    rateLog(
      'connection_attempt',
      'log',
      `Attempting to establish initial realtime connection (attempt ${connectionInitAttempts}/${MAX_CONNECTION_ATTEMPTS})`
    );
    
    isReconnecting = true;
    const realtimeClient = (supabase.realtime as any);
    
    if (!realtimeClient) {
      throw new Error('Realtime client not available');
    }
    
    // Force create a connection using low-level API if available
    if (realtimeClient._closeAndConnect && typeof realtimeClient._closeAndConnect === 'function') {
      try {
        // Use internal method to close any existing connection and create a new one
        await realtimeClient._closeAndConnect();
      } catch (err) {
        console.warn('Low-level connection attempt failed, falling back to standard connect');
      }
    }
    
    // Try to connect with timeout protection
    await Promise.race([
      realtimeClient.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timed out')), 25000)
      )
    ]);
    
    // Short delay to ensure stability
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if connection was successful
    if (realtimeClient.transport?.connectionState === 'open') {
      isInitialConnectionEstablished = true;
      isRealtimeHealthy = true;
      rateLog('connection_success', 'log', 'Successfully established initial realtime connection');
      
      // Create a test channel to verify two-way communication
      const testChannel = supabase.channel('connection-test-' + Date.now(), {
        config: { broadcast: { self: true } }
      });
      
      testChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          rateLog('connection_verified', 'log', 'Connection verified with test channel subscription');
          // Unsubscribe after success to clean up
          setTimeout(() => testChannel.unsubscribe(), 2000);
        }
      });
    } else {
      throw new Error(`Failed to establish initial connection, transport state: ${realtimeClient.transport?.connectionState || 'none'}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    rateLog('connection_error', 'error', errorMessage);
    
    // If we haven't reached max attempts, schedule next attempt with backoff
    if (connectionInitAttempts < MAX_CONNECTION_ATTEMPTS) {
      const backoffTime = calculateBackoff(connectionInitAttempts);
      rateLog('retry_scheduled', 'log', `Will retry in approximately ${Math.round(backoffTime / 1000)} seconds (attempt ${connectionInitAttempts}/${MAX_CONNECTION_ATTEMPTS})`);
      
      setTimeout(() => {
        isReconnecting = false;
        tryEstablishInitialConnection();
      }, backoffTime);
    } else {
      // Max attempts reached, give up on realtime
      rateLog('max_attempts', 'warn', 'Maximum connection attempts reached. Will use polling for all subscriptions.');
      realtimeGivenUp = true;
    }
  } finally {
    isReconnecting = false;
  }
}