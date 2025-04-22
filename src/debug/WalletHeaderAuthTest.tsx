import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';

export function WalletHeaderAuthTest() {
  const { walletAddress, walletAuthToken } = useWallet();
  const [result, setResult] = useState<any>(null);
  const [jwtDebugResult, setJwtDebugResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [jwtLoading, setJwtLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jwtError, setJwtError] = useState<string | null>(null);
  
  const testDirectFetch = async () => {
    if (!walletAddress || !walletAuthToken) {
      setError("Wallet address or auth token missing");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase URL or key not found");
      }
      
      // Use fetch directly with custom headers
      const response = await fetch(
        `${supabaseUrl}/rest/v1/user_orders?select=id,order_number,wallet_address&limit=5`, 
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'X-Wallet-Address': walletAddress,
            'X-Wallet-Auth-Token': walletAuthToken
          }
        }
      );
      
      // Get response status and headers
      const status = response.status;
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      // Try to parse JSON response
      let data;
      try {
        data = await response.json();
      } catch (e: unknown) {
        data = { parseError: e instanceof Error ? e.message : String(e) };
      }
      
      // Set result with all details
      setResult({
        success: response.ok,
        status,
        headers,
        data,
        request: {
          url: `${supabaseUrl}/rest/v1/user_orders?select=id,order_number,wallet_address&limit=5`,
          headers: {
            'X-Wallet-Address': walletAddress,
            'X-Wallet-Auth-Token': walletAuthToken.substring(0, 20) + '...',
          }
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
  
  // New function to test JWT authentication vs header authentication
  const testJwtAndHeaderAuth = async () => {
    if (!walletAddress) {
      setJwtError("Wallet address missing");
      return;
    }
    
    setJwtLoading(true);
    setJwtError(null);
    
    try {
      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase URL or key not found");
      }
      
      // First, try to call debug_wallet_auth function
      let response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/debug_wallet_auth`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'X-Wallet-Address': walletAddress,
            'X-Wallet-Auth-Token': walletAuthToken || ''
          },
          body: JSON.stringify({})
        }
      );
      
      // If that fails, try debug_wallet_rls as fallback
      if (!response.ok) {
        response = await fetch(
          `${supabaseUrl}/rest/v1/rpc/debug_wallet_rls`, 
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'X-Wallet-Address': walletAddress,
              'X-Wallet-Auth-Token': walletAuthToken || ''
            },
            body: JSON.stringify({ target_wallet: walletAddress })
          }
        );
      }
      
      // Try to parse JSON response
      let data;
      try {
        data = await response.json();
      } catch (e: unknown) {
        data = { parseError: e instanceof Error ? e.message : String(e) };
      }
      
      // Set result 
      setJwtDebugResult({
        success: response.ok,
        status: response.status,
        data
      });
    } catch (err) {
      setJwtError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setJwtLoading(false);
    }
  };
  
  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Wallet Header Auth Test</h2>
      
      <div className="mb-4">
        <div className="text-sm text-gray-400 mb-1">Wallet Address:</div>
        <div className="font-mono text-sm bg-gray-700 p-2 rounded">{walletAddress || 'Not connected'}</div>
      </div>
      
      <div className="mb-4">
        <div className="text-sm text-gray-400 mb-1">Auth Token:</div>
        <div className="font-mono text-xs bg-gray-700 p-2 rounded overflow-auto max-h-20">
          {walletAuthToken ? walletAuthToken.substring(0, 20) + '...' : 'No token'}
        </div>
      </div>
      
      <button
        onClick={testDirectFetch}
        disabled={loading || !walletAddress || !walletAuthToken}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-md text-white mb-4"
      >
        {loading ? 'Testing...' : 'Test Direct Fetch with Headers'}
      </button>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md text-red-300 text-sm">
          {error}
        </div>
      )}
      
      {result && (
        <div className="mt-4 mb-8">
          <div className="text-sm text-gray-400 mb-1">Result:</div>
          <div className="bg-gray-700 p-3 rounded overflow-auto max-h-80">
            <pre className="text-xs text-gray-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      {/* New JWT Debug Section */}
      <div className="mt-8 pt-6 border-t border-gray-700">
        <h3 className="text-md font-semibold mb-4">JWT Wallet Authentication Debug</h3>
        
        <button
          onClick={testJwtAndHeaderAuth}
          disabled={jwtLoading || !walletAddress}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-md text-white mb-4"
        >
          {jwtLoading ? 'Testing...' : 'Test Authentication Methods'}
        </button>
        
        {jwtError && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md text-red-300 text-sm">
            {jwtError}
          </div>
        )}
        
        {jwtDebugResult && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-gray-400">Authentication Debug:</div>
              <div className={`text-xs px-2 py-1 rounded ${jwtDebugResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                {jwtDebugResult.success ? 'Success' : `Failed (${jwtDebugResult.status})`}
              </div>
            </div>
            
            {jwtDebugResult.data?.direct_query?.count > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div className="text-xs p-2 bg-gray-700 rounded">
                  <div className="font-bold mb-1">Direct Query {jwtDebugResult.data.direct_query.count}</div>
                  <div className="space-y-1">
                    {jwtDebugResult.data.direct_query.sample.map((order: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span>{order.order_number}</span>
                        <span className="text-gray-400">{order.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="text-xs p-2 bg-gray-700 rounded">
                  <div className="font-bold mb-1">View Query {jwtDebugResult.data.view_query?.count || 0}</div>
                  <div className="space-y-1">
                    {(jwtDebugResult.data.view_query?.data || []).length > 0 ? 
                      jwtDebugResult.data.view_query.data.map((order: any, idx: number) => (
                        <div key={idx} className="flex justify-between">
                          <span>{order.order_number}</span>
                          <span className="text-gray-400">{order.status}</span>
                        </div>
                      )) : 
                      <div className="text-gray-400">No orders found</div>
                    }
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-gray-700 p-3 rounded overflow-auto max-h-80">
              <pre className="text-xs text-gray-300">
                {JSON.stringify(jwtDebugResult.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 