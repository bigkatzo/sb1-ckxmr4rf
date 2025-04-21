import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Bug, RefreshCw } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';

interface OrderDebugResult {
  directQuery?: any[];
  viewQuery?: any[];
  functionQuery?: any;
  errors?: {
    direct?: string;
    view?: string;
    function?: string;
  };
  timestamp: number;
}

export function OrderDebugPanel() {
  const { walletAddress, walletAuthToken } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<OrderDebugResult | null>(null);
  
  const runTests = async () => {
    if (!walletAddress) return;
    
    setIsLoading(true);
    
    try {
      const result: OrderDebugResult = {
        errors: {},
        timestamp: Date.now()
      };
      
      // First try direct query against orders table
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, wallet_address, status, created_at')
          .eq('wallet_address', walletAddress);
          
        result.directQuery = data || [];
        if (error) result.errors!.direct = error.message;
      } catch (err) {
        result.errors!.direct = err instanceof Error ? err.message : 'Unknown error';
      }
      
      // Then try user_orders view
      try {
        const { data, error } = await supabase
          .from('user_orders')
          .select('id, order_number, wallet_address, status, created_at');
          
        result.viewQuery = data || [];
        if (error) result.errors!.view = error.message;
      } catch (err) {
        result.errors!.view = err instanceof Error ? err.message : 'Unknown error';
      }
      
      // Finally try diagnostic function if available
      try {
        const { data, error } = await supabase
          .rpc('debug_orders_for_wallet', { target_wallet: walletAddress });
          
        result.functionQuery = data;
        if (error) result.errors!.function = error.message;
      } catch (err) {
        result.errors!.function = err instanceof Error ? err.message : 'Unknown error';
      }
      
      setResults(result);
      
      // Also log to console for better debugging
      console.log('Order Debug Results:', result);
      
    } catch (error) {
      console.error('Error in order debug panel:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!walletAddress) return null;
  
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-400"
        >
          <Bug className="h-3 w-3" />
          {isOpen ? 'Hide Order Debug' : 'Order Debug'}
        </button>
        
        {isOpen && (
          <button
            onClick={runTests}
            disabled={isLoading}
            className="text-xs flex items-center gap-1 bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-300"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Testing...' : 'Run Tests'}
          </button>
        )}
      </div>
      
      {isOpen && results && (
        <div className="bg-gray-900 p-3 rounded-lg text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-300 mb-2">Direct Query ({results.directQuery?.length || 0})</h3>
              <div className="bg-gray-800 p-2 rounded overflow-auto max-h-40">
                {results.errors?.direct ? (
                  <div className="text-red-400">{results.errors.direct}</div>
                ) : results.directQuery?.length ? (
                  <pre className="whitespace-pre-wrap text-gray-300">
                    {JSON.stringify(results.directQuery, null, 2)}
                  </pre>
                ) : (
                  <div className="text-gray-500">No orders found</div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-300 mb-2">View Query ({results.viewQuery?.length || 0})</h3>
              <div className="bg-gray-800 p-2 rounded overflow-auto max-h-40">
                {results.errors?.view ? (
                  <div className="text-red-400">{results.errors.view}</div>
                ) : results.viewQuery?.length ? (
                  <pre className="whitespace-pre-wrap text-gray-300">
                    {JSON.stringify(results.viewQuery, null, 2)}
                  </pre>
                ) : (
                  <div className="text-gray-500">No orders found</div>
                )}
              </div>
            </div>
          </div>
          
          {/* Function test results */}
          <div className="mt-3">
            <h3 className="font-medium text-gray-300 mb-2">Diagnostic Function</h3>
            <div className="bg-gray-800 p-2 rounded overflow-auto max-h-60">
              {results.errors?.function ? (
                <div className="text-yellow-400">{results.errors.function}</div>
              ) : results.functionQuery ? (
                <pre className="whitespace-pre-wrap text-gray-300">
                  {JSON.stringify(results.functionQuery, null, 2)}
                </pre>
              ) : (
                <div className="text-gray-500">No diagnostic data</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 