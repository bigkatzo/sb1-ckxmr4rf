import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';

export function WalletHeaderAuthTest() {
  const { walletAddress, walletAuthToken } = useWallet();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
        <div className="mt-4">
          <div className="text-sm text-gray-400 mb-1">Result:</div>
          <div className="bg-gray-700 p-3 rounded overflow-auto max-h-80">
            <pre className="text-xs text-gray-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
} 