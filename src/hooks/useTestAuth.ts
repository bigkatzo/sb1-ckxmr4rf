import { useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useSupabaseWithWallet } from './useSupabaseWithWallet';

/**
 * Test hook to verify authentication flow
 * This helps debug authentication issues
 */
export function useTestAuth() {
  const { 
    walletAddress, 
    authenticated, 
    isConnected, 
    supabaseAuthenticated,
    supabaseSession 
  } = useWallet();
  
  const { client: supabase, isAuthenticated, diagnostics } = useSupabaseWithWallet();
  
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const runAuthTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      console.log('🧪 Running authentication test...');
      
      // Test 1: Check wallet connection
      if (!walletAddress) {
        setTestResult('❌ No wallet address');
        return;
      }
      
      if (!isConnected) {
        setTestResult('❌ Wallet not connected');
        return;
      }
      
      if (!authenticated) {
        setTestResult('❌ Not authenticated with Privy');
        return;
      }
      
      // Test 2: Check Supabase authentication
      if (!supabaseAuthenticated) {
        setTestResult('❌ Not authenticated with Supabase');
        return;
      }
      
      if (!supabaseSession?.access_token) {
        setTestResult('❌ No Supabase session token');
        return;
      }
      
      // Test 3: Check Supabase client
      if (!supabase) {
        setTestResult('❌ No Supabase client');
        return;
      }
      
      if (!isAuthenticated) {
        setTestResult('❌ Supabase client not authenticated');
        return;
      }
      
      // Test 4: Try a simple query
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .limit(1);
      
      if (error) {
        setTestResult(`❌ Query failed: ${error.message}`);
        return;
      }
      
      setTestResult('✅ Authentication test passed! All systems working.');
      
    } catch (err) {
      console.error('Auth test error:', err);
      setTestResult(`❌ Test error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    // Auto-run test when authentication state changes
    if (walletAddress && isConnected && authenticated && supabaseAuthenticated) {
      runAuthTest();
    }
  }, [walletAddress, isConnected, authenticated, supabaseAuthenticated]);

  return {
    testResult,
    isTesting,
    runAuthTest,
    diagnostics: {
      walletAddress,
      isConnected,
      authenticated,
      supabaseAuthenticated,
      hasSupabaseSession: !!supabaseSession?.access_token,
      supabaseClientAuthenticated: isAuthenticated
    }
  };
}
