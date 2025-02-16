import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Required environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Service role key is optional and only used in production
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required Supabase environment variables');
}

// Regular client for normal operations
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Service role client for admin operations (only available in production)
export const supabaseAdmin = serviceRoleKey 
  ? createClient<Database>(
      supabaseUrl, 
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : null;

if (!supabaseAdmin) {
  console.warn('Supabase admin client is not initialized. Some admin features may be unavailable.');
}

// Add retry logic for failed requests
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 1000;
      const delay = delayMs * Math.pow(2, attempt) + jitter;
      
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Check if we should retry based on error type
      if (error instanceof Error) {
        // Don't retry auth errors or validation errors
        if (error.message.includes('auth/') || error.message.includes('validation')) {
          throw error;
        }
      }
      
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error);
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
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
  return withRetry(async () => {
    const connected = await checkConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }
    return operation();
  });
}