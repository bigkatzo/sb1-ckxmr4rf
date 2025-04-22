import { WalletHeaderAuthTest } from '../debug/WalletHeaderAuthTest';
import { useSupabaseWithWallet } from '../hooks/useSupabaseWithWallet';
import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';

export function WalletDebugPage() {
  const { client, isAuthenticated, walletAddress, diagnostics } = useSupabaseWithWallet();
  const { walletAuthToken } = useWallet();
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState<any>(null);

  // Get client configuration details for debugging
  useEffect(() => {
    if (client) {
      // Prepare safe-to-display client info
      const info = {
        initialized: true,
        headers: {
          'X-Wallet-Address': walletAddress,
          'X-Wallet-Auth-Token': walletAuthToken ? `${walletAuthToken.substring(0, 10)}...` : null,
          'Authorization': walletAuthToken ? 'Bearer [TOKEN]' : null
        },
        dbSchema: 'public',
        persistSession: false,
        autoRefreshToken: false,
        environment: import.meta.env.MODE || 'unknown',
        hasValidToken: !!walletAuthToken
      };
      setClientInfo(info);
    } else {
      setClientInfo({
        initialized: false,
        reason: diagnostics.reason || 'Unknown initialization failure'
      });
    }
  }, [client, walletAddress, walletAuthToken, diagnostics]);

  const testWalletAuthQuery = async () => {
    if (!client) {
      setError('Wallet authentication required');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Example query using the authenticated client
      const { data, error: queryError, status, statusText } = await client
        .from('user_orders')
        .select('id,order_number,wallet_address,created_at')
        .limit(5);
      
      if (queryError) {
        throw new Error(queryError.message);
      }
      
      setQueryResult({
        success: true,
        data,
        status,
        statusText,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error testing wallet auth:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setQueryResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8">Wallet Authentication Debug</h1>
      
      <div className="mb-6">
        <p className="text-gray-400 mb-4">
          This page helps you debug wallet authentication issues. It bypasses the Supabase SDK
          and allows direct testing of the header-based authentication.
        </p>
        
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-md p-4 mb-6">
          <h2 className="text-yellow-400 font-semibold mb-2">Important Information</h2>
          <ul className="list-disc list-inside text-sm space-y-2">
            <li>
              Make sure you've applied the SQL migration <code className="bg-black/30 px-1 rounded">20250616000000_simplified_wallet_header_check.sql</code>
            </li>
            <li>
              The migration creates SQL functions for header-based authentication
            </li>
            <li>
              If this test works but orders still aren't loading, check for potential permission issues
            </li>
          </ul>
        </div>
      </div>
      
      <WalletHeaderAuthTest />
      
      <div className="mt-12 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">useSupabaseWithWallet Hook Test</h2>
        
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Authentication Status:</div>
            <div className="font-mono text-sm bg-gray-700 p-2 rounded">
              {isAuthenticated 
                ? <span className="text-green-400">Authenticated ✓</span> 
                : <span className="text-red-400">Not Authenticated ✗</span>}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-400 mb-1">Wallet Address:</div>
            <div className="font-mono text-sm bg-gray-700 p-2 rounded">{walletAddress || 'Not connected'}</div>
          </div>
          
          <div className="md:col-span-2">
            <div className="text-sm text-gray-400 mb-1">Auth Token:</div>
            <div className="font-mono text-xs bg-gray-700 p-2 rounded overflow-auto max-h-20">
              {walletAuthToken 
                ? `${walletAuthToken.substring(0, 20)}...` 
                : 'No token'}
            </div>
          </div>
          
          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400 mb-1">Client Status:</div>
              <div className="text-xs px-2 py-1 rounded bg-gray-700">
                {client ? 
                  <span className="text-green-400">Initialized ✓</span> : 
                  <span className="text-red-400">Not Initialized ✗</span>
                }
              </div>
            </div>
            <div className="font-mono text-xs bg-gray-700 p-2 rounded overflow-auto max-h-40">
              {clientInfo && JSON.stringify(clientInfo, null, 2)}
            </div>
          </div>
        </div>
        
        <div className="mb-6 p-3 bg-gray-900 rounded-md border border-gray-700">
          <h3 className="text-sm font-medium mb-2 text-blue-400">Diagnostic Information:</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className={`p-2 text-xs rounded ${diagnostics.hasWallet ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
              <div className="font-semibold">Wallet Available</div>
              <div>{diagnostics.hasWallet ? 'Yes' : 'No'}</div>
            </div>
            <div className={`p-2 text-xs rounded ${diagnostics.isConnected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
              <div className="font-semibold">Wallet Connected</div>
              <div>{diagnostics.isConnected ? 'Yes' : 'No'}</div>
            </div>
            <div className={`p-2 text-xs rounded ${diagnostics.hasToken ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
              <div className="font-semibold">Auth Token</div>
              <div>{diagnostics.hasToken ? 'Available' : 'Missing'}</div>
            </div>
            <div className={`p-2 text-xs rounded ${diagnostics.hasEnvVars ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
              <div className="font-semibold">Environment Variables</div>
              <div>{diagnostics.hasEnvVars ? 'Available' : 'Missing'}</div>
            </div>
          </div>
          
          {diagnostics.reason && (
            <div className="p-2 bg-yellow-900/30 text-yellow-400 text-xs rounded">
              <div className="font-semibold">Initialization Issue:</div>
              <div>{diagnostics.reason}</div>
            </div>
          )}
        </div>
        
        <button
          onClick={testWalletAuthQuery}
          disabled={isLoading || !client}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-md text-white mb-4"
        >
          {isLoading ? 'Testing...' : 'Test useSupabaseWithWallet Hook'}
        </button>
        
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md text-red-300 text-sm">
            {error}
          </div>
        )}
        
        {queryResult && (
          <div className="p-3 bg-gray-900 rounded-md">
            <h3 className="text-sm font-medium mb-2 text-green-400">Query Results:</h3>
            <pre className="text-xs overflow-auto max-h-60 bg-black/20 p-2 rounded">
              {JSON.stringify(queryResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
} 