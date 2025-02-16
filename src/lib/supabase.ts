import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Required environment variables - keep VITE_ prefix for these
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Service role key - no VITE_ prefix as it's server-side only
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

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
  if (isDevelopment) {
    console.warn(
      '⚠️ Admin features are disabled in development mode\n\n' +
      'To enable admin features locally:\n' +
      '1. Go to https://supabase.com/dashboard\n' +
      '2. Select your project\n' +
      '3. Go to Project Settings > API\n' +
      '4. Copy the "service_role key" (NOT the anon key)\n' +
      '5. Add to your .env file: SUPABASE_SERVICE_ROLE_KEY=your_key\n' +
      '6. Restart your dev server\n\n' +
      'Note: Keep this key secret and never commit it to version control!'
    );
  } else {
    console.error(
      '🚨 Admin features are disabled in production\n\n' +
      'To fix this:\n' +
      '1. Go to your Netlify dashboard\n' +
      '2. Navigate to Site settings > Build & deploy > Environment\n' +
      '3. Add environment variable: SUPABASE_SERVICE_ROLE_KEY\n' +
      '4. Trigger a new deployment\n\n' +
      'For better security, consider moving admin operations to Netlify Functions'
    );
  }
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