import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Required environment variables - keep VITE_ prefix for these
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Regular client for normal operations
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

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
          details: { message: 'Connection timed out after 5 seconds' }
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
              channelTopic: channel.topic
            }
          });
        } else if (status === 'CHANNEL_ERROR') {
          cleanup();
          resolve({
            status: 'error',
            details: { message: 'Channel error', channelStatus: status }
          });
        } else if (status === 'TIMED_OUT') {
          cleanup();
          resolve({
            status: 'timeout',
            details: { message: 'Channel timed out', channelStatus: status }
          });
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