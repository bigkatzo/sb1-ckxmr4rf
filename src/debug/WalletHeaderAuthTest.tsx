import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';

export function WalletHeaderAuthTest() {
  const { walletAddress, walletAuthToken } = useWallet();
  const [result, setResult] = useState<any>(null);
  const [jwtDebugResult, setJwtDebugResult] = useState<any>(null);
  const [directOrdersResult, setDirectOrdersResult] = useState<any>(null);
  const [unifiedDebugResult, setUnifiedDebugResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [jwtLoading, setJwtLoading] = useState(false);
  const [directLoading, setDirectLoading] = useState(false);
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jwtError, setJwtError] = useState<string | null>(null);
  const [directError, setDirectError] = useState<string | null>(null);
  const [unifiedError, setUnifiedError] = useState<string | null>(null);
  
  // Safely render JSON data
  const safeJsonString = (data: any) => {
    try {
      if (typeof data === 'string') return data;
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return "Error converting data to JSON";
    }
  };
  
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
  
  // function to test JWT authentication vs header authentication
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
      
      // Call the simplified debug function
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/debug_wallet_headers_raw`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'X-Wallet-Address': walletAddress,
            'X-Wallet-Auth-Token': walletAuthToken || ''
          },
          body: JSON.stringify({ test_wallet: walletAddress })
        }
      );
      
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
  
  // Function to test direct orders function
  const testDirectOrders = async () => {
    if (!walletAddress) {
      setDirectError("Wallet address missing");
      return;
    }
    
    setDirectLoading(true);
    setDirectError(null);
    
    try {
      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase URL or key not found");
      }
      
      // Call the direct function
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_wallet_orders_direct`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'X-Wallet-Address': walletAddress,
            'X-Wallet-Auth-Token': walletAuthToken || ''
          },
          body: JSON.stringify({ wallet_addr: walletAddress })
        }
      );
      
      // Try to parse JSON response
      let data;
      try {
        data = await response.json();
      } catch (e: unknown) {
        data = { parseError: e instanceof Error ? e.message : String(e) };
      }
      
      // Set result 
      setDirectOrdersResult({
        success: response.ok,
        status: response.status,
        data
      });
    } catch (err) {
      setDirectError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDirectLoading(false);
    }
  };
  
  // Test our unified wallet debug function
  const testUnifiedDebug = async () => {
    if (!walletAddress) {
      setUnifiedError("Wallet address missing");
      return;
    }
    
    setUnifiedLoading(true);
    setUnifiedError(null);
    
    try {
      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase URL or key not found");
      }
      
      // Call the new unified debug function
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/wallet_auth_debug`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'X-Wallet-Address': walletAddress,
            'X-Wallet-Auth-Token': walletAuthToken || ''
          },
          body: JSON.stringify({ wallet_addr: walletAddress })
        }
      );
      
      // Try to parse JSON response
      let data;
      try {
        data = await response.json();
      } catch (e: unknown) {
        data = { parseError: e instanceof Error ? e.message : String(e) };
      }
      
      // Set result 
      setUnifiedDebugResult({
        success: response.ok,
        status: response.status,
        data
      });
    } catch (err) {
      setUnifiedError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUnifiedLoading(false);
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
              {safeJsonString(result)}
            </pre>
          </div>
        </div>
      )}
      
      {/* JWT Debug Section */}
      <div className="mt-8 pt-6 border-t border-gray-700">
        <h3 className="text-md font-semibold mb-4">Wallet Authentication Debug</h3>
        
        <div className="flex flex-wrap gap-4 mb-4">
          <button
            onClick={testJwtAndHeaderAuth}
            disabled={jwtLoading || !walletAddress}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-md text-white"
          >
            {jwtLoading ? 'Testing...' : 'Test Headers Debug'}
          </button>
          
          <button
            onClick={testDirectOrders}
            disabled={directLoading || !walletAddress}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md text-white"
          >
            {directLoading ? 'Testing...' : 'Test Direct Orders'}
          </button>
          
          <button
            onClick={testUnifiedDebug}
            disabled={unifiedLoading || !walletAddress}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 rounded-md text-white"
          >
            {unifiedLoading ? 'Testing...' : 'Run Unified Debug'}
          </button>
        </div>
        
        {jwtError && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md text-red-300 text-sm">
            {jwtError}
          </div>
        )}
        
        {directError && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md text-red-300 text-sm">
            {directError}
          </div>
        )}
        
        {unifiedError && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-md text-red-300 text-sm">
            {unifiedError}
          </div>
        )}
        
        {unifiedDebugResult && (
          <div className="mt-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-gray-400">Unified Debug:</div>
              <div className={`text-xs px-2 py-1 rounded ${unifiedDebugResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                {unifiedDebugResult.success ? 'Success' : `Failed (${unifiedDebugResult.status})`}
              </div>
            </div>
            
            {unifiedDebugResult.data?.order_sample && unifiedDebugResult.data.order_sample.length > 0 && (
              <div className="mb-3 bg-gray-900/50 p-3 rounded">
                <div className="text-sm font-medium mb-2 text-gray-300">Order Sample</div>
                <div className="space-y-1">
                  {unifiedDebugResult.data.order_sample.map((order: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="font-mono">{order.order_number}</span>
                      <span className={`
                        ${order.status === 'confirmed' ? 'text-green-400' : ''}
                        ${order.status === 'pending_payment' ? 'text-yellow-400' : ''}
                        ${order.status === 'cancelled' ? 'text-red-400' : ''}
                        ${order.status === 'shipped' ? 'text-blue-400' : ''}
                      `}>{order.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="bg-gray-700 p-3 rounded overflow-auto max-h-80">
              <pre className="text-xs text-gray-300">
                {safeJsonString(unifiedDebugResult.data)}
              </pre>
            </div>
          </div>
        )}
        
        {jwtDebugResult && (
          <div className="mt-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-gray-400">Headers Debug:</div>
              <div className={`text-xs px-2 py-1 rounded ${jwtDebugResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                {jwtDebugResult.success ? 'Success' : `Failed (${jwtDebugResult.status})`}
              </div>
            </div>
            
            <div className="bg-gray-700 p-3 rounded overflow-auto max-h-80">
              <pre className="text-xs text-gray-300">
                {safeJsonString(jwtDebugResult.data)}
              </pre>
            </div>
          </div>
        )}
        
        {directOrdersResult && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-gray-400">Direct Orders Result:</div>
              <div className={`text-xs px-2 py-1 rounded ${directOrdersResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                {directOrdersResult.success ? 'Success' : `Failed (${directOrdersResult.status})`}
              </div>
            </div>
            
            <div className="bg-gray-700 p-3 rounded overflow-auto max-h-80">
              <pre className="text-xs text-gray-300">
                {safeJsonString(directOrdersResult.data)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 