import { createClient } from '@supabase/supabase-js';
import type { PostgrestResponse, PostgrestBuilder } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Required environment variables - keep VITE_ prefix for these
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Regular client for normal operations
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Retry function for Supabase operations
export async function withRetry<T>(
  operation: () => PostgrestBuilder<T>,
  maxRetries = 3,
  delay = 1000
): Promise<PostgrestResponse<T>> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await operation();
      return result as PostgrestResponse<T>;
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
  return withRetry(async () => {
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