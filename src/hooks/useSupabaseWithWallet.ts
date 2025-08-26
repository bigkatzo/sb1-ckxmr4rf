import { useMemo, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useWallet } from '../contexts/WalletContext';
import type { Database } from '../lib/database.types';

/**
 * Custom hook that returns a Supabase client with wallet authentication
 * 
 * This client uses the Supabase session from the wallet context to provide
 * proper JWT authentication for RLS policies, while also including wallet
 * headers for additional wallet-specific authentication.
 * 
 * Updated to work with Privy wallet integration and Supabase authentication
 */
export function useSupabaseWithWallet(options?: { allowMissingToken?: boolean }): {
  client: SupabaseClient<Database> | null;
  isAuthenticated: boolean;
  walletAddress: string | null;
  diagnostics: {
    hasWallet: boolean;
    hasToken: boolean;
    isConnected: boolean;
    hasEnvVars: boolean;
    hasSupabaseSession: boolean;
    reason: string | null;
  };
} {
  const { 
    walletAddress, 
    walletAuthToken, 
    isConnected, 
    authenticated, 
    supabaseAuthenticated,
    supabaseSession 
  } = useWallet();
  const allowMissingToken = options?.allowMissingToken || false;
  
  // Check environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const hasEnvVars = !!supabaseUrl && !!supabaseKey;
  
  // Get diagnostic information for debugging
  const diagnostics = useMemo(() => {
    const hasWallet = !!walletAddress;
    const hasToken = !!walletAuthToken;
    const hasSupabaseSession = !!supabaseSession?.access_token;
    
    let reason = null;
    if (!hasEnvVars) reason = 'Missing environment variables';
    else if (!hasWallet) reason = 'No wallet address';
    else if (!isConnected) reason = 'Wallet not connected';
    else if (!authenticated) reason = 'Not authenticated with Privy';
    else if (!supabaseAuthenticated) reason = 'Not authenticated with Supabase';
    else if (!allowMissingToken && !hasToken) reason = 'No auth token';
    else if (!hasSupabaseSession) reason = 'No Supabase session';
    
    return {
      hasWallet,
      hasToken,
      isConnected,
      hasEnvVars,
      hasSupabaseSession,
      reason
    };
  }, [walletAddress, walletAuthToken, isConnected, authenticated, hasEnvVars, allowMissingToken, supabaseAuthenticated, supabaseSession]);
  
  // Log diagnostics in development
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🔍 useSupabaseWithWallet diagnostics:', diagnostics);
    }
  }, [diagnostics, allowMissingToken]);
  
  // Create Supabase client with proper authentication
  const client = useMemo<SupabaseClient<Database> | null>(() => {
    // Check if we have wallet address and are connected
    if (!walletAddress || !isConnected || !authenticated) {
      return null;
    }
    
    // Get Supabase URL and anon key from environment variables
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase URL or key not found in environment variables');
      return null;
    }
    
    // Log successful client creation in development
    if (import.meta.env.DEV) {
      console.log('✓ Creating Supabase client', {
        hasToken: !!walletAuthToken,
        hasSupabaseSession: !!supabaseSession?.access_token,
        supabaseAuthenticated,
        walletAddress: walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : null
      });
    }
    
    // Prepare headers for wallet-specific authentication
    const headers: Record<string, string> = {
      // Always include wallet address
      'X-Wallet-Address': walletAddress
    };
    
    // Add token headers if available
    if (walletAuthToken) {
      headers['X-Wallet-Auth-Token'] = walletAuthToken;
      headers['X-Authorization'] = `Bearer ${walletAuthToken}`;
    }
    
    // Create a client with wallet authentication headers
    return createClient<Database>(supabaseUrl, supabaseKey, {
      db: {
        schema: 'public'
      },
      auth: {
        // Use the session from wallet context if available
        persistSession: false, 
        autoRefreshToken: false,
        detectSessionInUrl: false,
        // Set the session manually
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      },
      global: {
        headers
      }
    });
  }, [walletAddress, walletAuthToken, isConnected, authenticated, supabaseAuthenticated, supabaseSession, supabaseUrl, supabaseKey]);
  
  // Set the session on the client if we have one
  useEffect(() => {
    if (client && supabaseSession?.access_token) {
      // Set the session on the client
      client.auth.setSession(supabaseSession);
    }
  }, [client, supabaseSession]);
  
  return {
    client,
    isAuthenticated: !!client && (!!supabaseSession?.access_token || supabaseAuthenticated),
    walletAddress,
    diagnostics
  };
}