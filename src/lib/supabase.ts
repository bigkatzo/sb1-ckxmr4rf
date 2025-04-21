import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Required environment variables - keep VITE_ prefix for these
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Event for auth expiration that components can listen to
export const AUTH_EXPIRED_EVENT = 'supabase-auth-expired';

// Regular client for normal operations with optimized realtime settings
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 2,
      heartbeatIntervalMs: 45000,
      fastConnectOptions: {
        ackTimeout: 45000,
        retries: 5,
        timeout: 45000
      }
    }
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage
  },
  global: {
    headers: {
      'X-Client-Info': 'storedot-web'
    },
    // Add global error handling with retry logic
    fetch: async (url, options = {}) => {
      const maxRetries = 3;
      let lastError;
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          // Add retry attempt header for debugging
          const headers = new Headers(options.headers || {});
          if (i > 0) {
            headers.set('X-Retry-Attempt', i.toString());
          }
          
          const response = await fetch(url, {
            ...options,
            headers
          });

          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            await new Promise(resolve => 
              setTimeout(resolve, (parseInt(retryAfter || '5') * 1000))
            );
            continue;
          }

          // Handle auth errors
          if (response.status === 401) {
            // Try to refresh the token
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (!refreshError) {
              continue; // Retry with new token
            } else {
              // Auth expired - dispatch custom event for wallet reconnection
              window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
              console.log('Auth token expired, reconnection required');
            }
          }

          return response;
        } catch (error) {
          lastError = error;
          if (i < maxRetries - 1) {
            // Add exponential backoff
            await new Promise(resolve => 
              setTimeout(resolve, Math.pow(2, i) * 1000)
            );
          }
        }
      }
      
      console.error('Supabase fetch error after retries:', lastError);
      throw lastError;
    }
  }
});

/**
 * Generic retry function for any async operation
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
}

// Add connection status check
export async function checkConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_database_connection');
    return !error && data === true;
  } catch (error) {
    console.error('Connection check failed:', error);
    return false;
  }
}

// Wrap database operations with retry logic
export async function safeQuery<T>(
  operation: () => Promise<T>
): Promise<T> {
  return retry(async () => {
    const connected = await checkConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }
    return operation();
  });
}

// Helper for admin operations using database RPC functions
export async function adminQuery<T>(
  operation: (client: typeof supabase) => Promise<T>
): Promise<T> {
  // First verify admin access through RPC
  const { data: isAdmin, error: adminCheckError } = await supabase.rpc('is_admin');
  
  if (adminCheckError || !isAdmin) {
    throw new Error('You do not have admin access to perform this operation');
  }
  
  // Execute the operation using the regular client
  // The database RPC functions will handle admin permissions
  return safeQuery(() => operation(supabase));
}

// Add diagnostic function for realtime connection
export async function checkRealtimeConnection(): Promise<{
  status: string;
  details: Record<string, any>;
}> {
  try {
    // Check basic connection first
    const connectionOk = await checkConnection();
    if (!connectionOk) {
      return {
        status: 'error',
        details: { message: 'Database connection failed' }
      };
    }

    // Collect information about the current Supabase client
    const realtimeInfo = {
      // Access realtime properties safely with type casting
      url: (supabase.realtime as any)?.url,
      config: (supabase.realtime as any)?.config,
      status: (supabase.realtime as any)?.transport?.connectionState || 'unknown'
    };

    // Create a temporary channel to test realtime
    const channel = supabase.channel('connection-test', {
      config: { broadcast: { self: true } }
    });

    // Set up a promise to track connection status
    const connectionPromise = new Promise<{
      status: string;
      details: Record<string, any>;
    }>((resolve) => {
      let timeout: any = null;
      
      // Set timeout for connection
      timeout = setTimeout(() => {
        cleanup();
        resolve({
          status: 'timeout',
          details: { 
            message: 'Connection timed out after 5 seconds',
            realtimeInfo
          }
        });
      }, 5000);
      
      const cleanup = () => {
        clearTimeout(timeout);
        channel.unsubscribe();
      };

      // Handle successful connection
      channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          cleanup();
          resolve({
            status: 'connected',
            details: {
              supabaseUrl,
              channelTopic: channel.topic,
              realtimeInfo
            }
          });
        } else if (status === 'CHANNEL_ERROR') {
          cleanup();
          resolve({
            status: 'error',
            details: { 
              message: 'Channel error', 
              channelStatus: status,
              realtimeInfo
            }
          });
        } else if (status === 'TIMED_OUT') {
          cleanup();
          resolve({
            status: 'timeout',
            details: { 
              message: 'Channel timed out', 
              channelStatus: status,
              realtimeInfo
            }
          });
        } else {
          // Log other statuses for debugging
          console.log(`Test channel status: ${status}`);
        }
      });
    });

    return connectionPromise;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: 'error',
      details: { message: 'Connection check error', error: errorMessage }
    };
  }
}

// Create a utility function to diagnose and fix common realtime issues
export async function diagnoseRealtimeIssues(): Promise<{
  status: string;
  issues: string[];
  recommendations: string[];
}> {
  try {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status = 'healthy';

    // Check basic connectivity
    const connectionResult = await checkRealtimeConnection();
    
    if (connectionResult.status !== 'connected') {
      status = 'issues_detected';
      issues.push(`Realtime connection test failed: ${connectionResult.status}`);
      recommendations.push('Check if realtime is enabled in your Supabase project settings');
      recommendations.push('Verify your Supabase URL and anon key are correct');
    }
    
    // Check client configuration
    if (!supabase.realtime) {
      status = 'issues_detected';
      issues.push('Realtime client not properly initialized');
      recommendations.push('Ensure your Supabase client version is up to date');
    }
    
    // Check for excessive connections - safely access channels
    const activeChannels = Object.keys(supabase.getChannels?.() || {}).length;
    if (activeChannels > 10) {
      status = 'issues_detected';
      issues.push(`High number of active channels: ${activeChannels}`);
      recommendations.push('Consider consolidating realtime subscriptions');
      recommendations.push('Ensure channels are properly unsubscribed when components unmount');
    }
    
    // If no issues detected
    if (issues.length === 0) {
      recommendations.push('Realtime appears to be configured correctly');
    }
    
    return {
      status,
      issues,
      recommendations
    };
  } catch (error) {
    return {
      status: 'error',
      issues: ['Error while diagnosing realtime connection'],
      recommendations: ['Check browser console for detailed error information']
    };
  }
}

/**
 * Utility function to test and fix Supabase realtime connections
 * Returns diagnostics and attempts to fix common issues
 */
export async function testAndFixRealtimeConnection(): Promise<{
  status: string;
  diagnostics: Record<string, any>;
  fixAttempted: boolean;
  fixResult?: string;
}> {
  try {
    // Run diagnostics
    const diagnostics = await diagnoseRealtimeIssues();
    let fixAttempted = false;
    let fixResult = '';
    
    // If issues detected, try to fix them
    if (diagnostics.status === 'issues_detected') {
      fixAttempted = true;
      
      try {
        // 1. First try to reconnect the realtime client
        console.log('Attempting to fix realtime connection issues...');
        
        // Force reconnect the realtime client if possible
        if ((supabase.realtime as any)?.connect) {
          (supabase.realtime as any).connect();
          fixResult = 'Attempted to reconnect the realtime client';
        }
        
        // 2. Close any stale channels
        const channels = supabase.getChannels?.() || [];
        for (const channel of channels) {
          if ((channel as any)?.state === 'closed' || (channel as any)?.state === 'errored') {
            channel.unsubscribe();
            fixResult += '\nClosed stale channel: ' + channel.topic;
          }
        }
      } catch (fixError) {
        fixResult = `Fix attempt failed: ${fixError instanceof Error ? fixError.message : String(fixError)}`;
      }
    }
    
    return {
      status: diagnostics.status,
      diagnostics,
      fixAttempted,
      fixResult: fixAttempted ? fixResult : undefined
    };
  } catch (error) {
    return {
      status: 'error',
      diagnostics: {
        issues: ['Error running realtime diagnostics'],
        recommendations: ['Check browser console for detailed error information']
      },
      fixAttempted: false
    };
  }
}