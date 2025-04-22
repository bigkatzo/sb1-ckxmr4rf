import { useMemo, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useWallet } from '../contexts/WalletContext';
import type { Database } from '../lib/database.types';

/**
 * Custom hook that returns a Supabase client with wallet authentication headers
 * 
 * This client automatically includes the wallet address and authentication token
 * in the headers of all requests, which allows the Supabase RLS policies to verify
 * the wallet ownership and restrict data access accordingly.
 */
export function useSupabaseWithWallet(): {
  client: SupabaseClient<Database> | null;
  isAuthenticated: boolean;
  walletAddress: string | null;
  diagnostics: {
    hasWallet: boolean;
    hasToken: boolean;
    isConnected: boolean;
    hasEnvVars: boolean;
    reason: string | null;
  };
} {
  const { walletAddress, walletAuthToken, isConnected } = useWallet();
  
  // Check environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const hasEnvVars = !!supabaseUrl && !!supabaseKey;
  
  // Get diagnostic information for debugging
  const diagnostics = {
    hasWallet: !!walletAddress,
    hasToken: !!walletAuthToken,
    isConnected,
    hasEnvVars,
    reason: !walletAddress
      ? "No wallet address available"
      : !isConnected
        ? "Wallet not connected"
        : !walletAuthToken
          ? "No wallet authentication token"
          : !hasEnvVars
            ? "Missing Supabase environment variables"
            : null
  };
  
  // Development-only debug logging
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.group('useSupabaseWithWallet Diagnostics');
      console.log('Wallet Address:', walletAddress ? `${walletAddress.substring(0, 8)}...` : 'null');
      console.log('Auth Token:', walletAuthToken ? 'Available' : 'Missing');
      console.log('Wallet Connected:', isConnected);
      console.log('Environment Variables:', hasEnvVars ? 'Available' : 'Missing');
      console.log('Client Initialized:', diagnostics.reason ? `No - ${diagnostics.reason}` : 'Yes');
      console.groupEnd();
    }
  }, [walletAddress, walletAuthToken, isConnected, hasEnvVars, diagnostics]);
  
  // Create a memoized client instance that will only be recreated when auth details change
  const client = useMemo(() => {
    // Only create client if we have both wallet address and auth token
    if (!walletAddress || !isConnected || !walletAuthToken) {
      return null;
    }
    
    // Get Supabase URL and anon key from environment variables
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or key not found in environment variables');
      return null;
    }
    
    // Log successful client creation in development
    if (import.meta.env.DEV) {
      console.log('✓ Creating Supabase client with wallet auth headers');
    }
    
    // Check if the token is a custom format (not a standard JWT)
    const isCustomToken = walletAuthToken.startsWith('WALLET_VERIFIED_') || 
                          walletAuthToken.startsWith('WALLET_AUTH_');
    
    // Create a client with wallet authentication headers
    return createClient<Database>(supabaseUrl, supabaseKey, {
      db: {
        schema: 'public'
      },
      auth: {
        // Skip persisting the session to avoid conflicts with other Supabase instances
        persistSession: false, 
        autoRefreshToken: false,
        // For custom tokens, we don't want Supabase to try to parse it as a JWT
        detectSessionInUrl: !isCustomToken
      },
      global: {
        headers: {
          // Include wallet address and auth token in headers for RLS policy verification
          'X-Wallet-Address': walletAddress,
          'X-Wallet-Auth-Token': walletAuthToken,
          
          // Always include X-Authorization header for custom tokens
          // Our SQL functions specifically look for this
          'X-Authorization': `Bearer ${walletAuthToken}`,
          
          // Only include standard Authorization header if it's not a custom token
          // to avoid JWT parsing errors in Supabase client
          ...(isCustomToken 
            ? {} 
            : { 'Authorization': `Bearer ${walletAuthToken}` })
        }
      }
    });
  }, [walletAddress, walletAuthToken, isConnected, supabaseUrl, supabaseKey]);
  
  return {
    client,
    isAuthenticated: !!walletAuthToken,
    walletAddress,
    diagnostics
  };
} 