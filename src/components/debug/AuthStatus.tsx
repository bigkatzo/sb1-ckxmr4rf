import React from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { useSupabaseWithWallet } from '../../hooks/useSupabaseWithWallet';
import { useTestAuth } from '../../hooks/useTestAuth';

/**
 * Debug component to show authentication status
 * Only shows in development mode
 */
export function AuthStatus() {
  const { 
    walletAddress, 
    authenticated, 
    isConnected, 
    supabaseAuthenticated,
    supabaseSession 
  } = useWallet();
  
  const { client: supabase, isAuthenticated, diagnostics } = useSupabaseWithWallet();
  const { testResult, isTesting, runAuthTest, diagnostics: testDiagnostics } = useTestAuth();

  // Only show in development
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg max-w-md text-xs z-50">
      <h3 className="font-bold mb-2">🔐 Auth Status</h3>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Wallet:</span>
          <span className={walletAddress ? 'text-green-400' : 'text-red-400'}>
            {walletAddress ? `${walletAddress.slice(0, 8)}...` : 'None'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Connected:</span>
          <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
            {isConnected ? 'Yes' : 'No'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Privy Auth:</span>
          <span className={authenticated ? 'text-green-400' : 'text-red-400'}>
            {authenticated ? 'Yes' : 'No'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Supabase Auth:</span>
          <span className={supabaseAuthenticated ? 'text-green-400' : 'text-red-400'}>
            {supabaseAuthenticated ? 'Yes' : 'No'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Session Token:</span>
          <span className={supabaseSession?.access_token ? 'text-green-400' : 'text-red-400'}>
            {supabaseSession?.access_token ? 'Yes' : 'No'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Client Auth:</span>
          <span className={isAuthenticated ? 'text-green-400' : 'text-red-400'}>
            {isAuthenticated ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
      
      {testResult && (
        <div className="mt-2 p-2 bg-gray-800 rounded">
          <div className="font-semibold">Test Result:</div>
          <div className={testResult.includes('✅') ? 'text-green-400' : 'text-red-400'}>
            {testResult}
          </div>
        </div>
      )}
      
      <button
        onClick={runAuthTest}
        disabled={isTesting}
        className="mt-2 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-2 py-1 rounded text-xs"
      >
        {isTesting ? 'Testing...' : 'Run Auth Test'}
      </button>
      
      {diagnostics.reason && (
        <div className="mt-2 p-2 bg-red-900/50 rounded">
          <div className="font-semibold text-red-400">Issue:</div>
          <div className="text-red-300">{diagnostics.reason}</div>
        </div>
      )}
    </div>
  );
}
