import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Required environment variables - keep VITE_ prefix for these
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Service role key - no VITE_ prefix as it's server-side only
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if we're in production (Netlify)
const isProduction = import.meta.env.PROD;

// Validate required environment variables
if (!supabaseUrl) {
  throw new Error(
    'Missing VITE_SUPABASE_URL environment variable\n' +
    'Make sure you have VITE_SUPABASE_URL set in your .env file'
  );
}

if (!supabaseKey) {
  throw new Error(
    'Missing VITE_SUPABASE_ANON_KEY environment variable\n' +
    'Make sure you have VITE_SUPABASE_ANON_KEY set in your .env file'
  );
}

// Regular client for normal operations
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Service role client for admin operations
export const supabaseAdmin = serviceRoleKey 
  ? createClient<Database>(
      supabaseUrl, 
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    )
  : null;

// Log appropriate warning based on environment
if (!supabaseAdmin) {
  if (isProduction) {
    console.error(
      '🚨 Critical: Admin features are disabled because SUPABASE_SERVICE_ROLE_KEY is not detected.\n\n' +
      'To fix this:\n' +
      '1. Verify the key is set in Netlify (Site settings > Build & deploy > Environment)\n' +
      '2. Make sure the key is correct (from Supabase Dashboard > Project Settings > API)\n' +
      '3. Ensure "All scopes" is selected in Netlify\n' +
      '4. Try triggering a new deployment\n\n' +
      'Current environment: Production (Netlify)'
    );
  } else {
    console.info(
      '📝 Local Development: Admin features are disabled\n\n' +
      'This is normal in development unless you specifically need admin features.\n\n' +
      'To enable admin features locally:\n' +
      '1. Get your service role key from Supabase Dashboard > Project Settings > API\n' +
      '2. Add to your .env file: SUPABASE_SERVICE_ROLE_KEY=your_key\n' +
      '3. Restart your dev server\n\n' +
      'Current environment: Development'
    );
  }
}

// Helper to check if admin features are available
export const isAdminEnabled = (): boolean => {
  const hasAdminClient = supabaseAdmin !== null;
  if (!hasAdminClient) {
    const message = isProduction
      ? 'Admin features are disabled. The service role key is not detected in Netlify environment variables.'
      : 'Admin features are disabled. Add SUPABASE_SERVICE_ROLE_KEY to your .env file for local testing.';
    console.error(message);
  }
  return hasAdminClient;
};

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

// Helper for admin operations
export async function adminQuery<T>(
  operation: (admin: typeof supabaseAdmin) => Promise<T>
): Promise<T> {
  if (!supabaseAdmin) {
    throw new Error(
      isProduction
        ? 'Admin features are disabled in production. Check Netlify environment variables.'
        : 'Admin features are disabled in development. Add SUPABASE_SERVICE_ROLE_KEY to .env if needed.'
    );
  }
  
  return safeQuery(() => operation(supabaseAdmin));
}