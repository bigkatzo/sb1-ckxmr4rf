import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWallet } from '../../contexts/WalletContext';

export function OrderDebugPanel() {
  const { walletAddress, walletAuthToken } = useWallet();
  const [jwtInfo, setJwtInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewResults, setViewResults] = useState<any>(null);
  const [directResults, setDirectResults] = useState<any>(null);
  
  // Run JWT debug info when mounted
  useEffect(() => {
    async function getJwtInfo() {
      if (!walletAuthToken) {
        setJwtInfo(null);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Try to decode the JWT without validation (client-side only)
        if (walletAuthToken.includes('WALLET_AUTH_SIGNATURE')) {
          // Custom wallet auth token format
          const parts = walletAuthToken.split('_');
          if (parts.length >= 3) {
            setJwtInfo({
              type: 'custom-wallet-jwt',
              wallet_address: parts[2],
              extracted_from: 'token_format',
              timestamp: parts[4]
            });
          }
        } else if (walletAuthToken.split('.').length === 3) {
          // Standard JWT format
          const [, payloadBase64] = walletAuthToken.split('.');
          // Fix padding for base64url
          const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
          const jsonStr = atob(base64);
          const payload = JSON.parse(jsonStr);
          
          setJwtInfo({
            type: 'standard-jwt',
            wallet_address: payload.wallet_address || payload.user_metadata?.wallet_address,
            extracted_from: payload.wallet_address ? 'root' : 'user_metadata',
            exp: new Date((payload.exp || 0) * 1000).toISOString(),
            keys: Object.keys(payload)
          });
        }
        
        // Check session to confirm token is working
        const { data: session } = await supabase.auth.getSession();
        if (session?.session) {
          setJwtInfo((prev: any) => ({
            ...prev,
            session_active: true,
            session_user_id: session.session.user?.id || null
          }));
        }
        
        // Try direct query against orders using our RPC function
        if (walletAddress) {
          try {
            const { data: rpcData, error: rpcError } = await supabase
              .rpc('get_wallet_orders', { wallet_addr: walletAddress })
              .select('id, order_number, wallet_address, status, created_at')
              .limit(4);
            
            setDirectResults({
              data: rpcData,
              count: rpcData?.length || 0,
              error: rpcError ? rpcError.message : null
            });
          } catch (directErr) {
            console.error("Error calling get_wallet_orders RPC:", directErr);
            setDirectResults({
              data: null,
              count: 0, 
              error: directErr instanceof Error ? directErr.message : "Unknown error calling RPC"
            });
            
            // Try debug function as fallback
            try {
              const { data: debugData } = await supabase
                .rpc('debug_auth_status');
              
              setDirectResults((prev: any) => ({
                ...prev,
                debugInfo: debugData
              }));
            } catch (debugErr) {
              // Ignore debug errors
            }
          }
        }
        
        // Try query against user_orders view
        const { data: viewData, error: viewError } = await supabase
          .from('user_orders')
          .select('id, order_number, wallet_address, status, created_at')
          .limit(4);
        
        setViewResults({
          data: viewData,
          count: viewData?.length || 0,
          error: viewError ? viewError.message : null
        });
        
      } catch (err) {
        console.error('Error decoding JWT:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    getJwtInfo();
  }, [walletAuthToken, walletAddress]);
  
  if (!walletAuthToken) {
    return (
      <div className="bg-gray-800/50 p-3 rounded-lg text-xs text-gray-400">
        No wallet auth token available
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800/50 p-3 rounded-lg text-xs space-y-3">
      <h3 className="font-medium text-gray-300">JWT Wallet Authentication Debug</h3>
      
      {isLoading ? (
        <div className="text-gray-400">Loading JWT info...</div>
      ) : (
        <div className="space-y-3">
          {jwtInfo && (
            <div className="p-2 bg-gray-900/50 rounded">
              <h4 className="font-medium text-gray-400 mb-1">JWT Token Info</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="text-gray-500">Type:</div>
                <div className="text-gray-300">{jwtInfo.type}</div>
                
                <div className="text-gray-500">Wallet:</div>
                <div className="text-gray-300 font-mono text-[9px] break-all">
                  {jwtInfo.wallet_address || 'Not found'}
                </div>
                
                <div className="text-gray-500">Extracted From:</div>
                <div className="text-gray-300">{jwtInfo.extracted_from}</div>
                
                <div className="text-gray-500">Session:</div>
                <div className="text-gray-300">
                  {jwtInfo.session_active ? 'Active' : 'Inactive'}
                </div>
                
                {jwtInfo.exp && (
                  <>
                    <div className="text-gray-500">Expires:</div>
                    <div className="text-gray-300">{jwtInfo.exp}</div>
                  </>
                )}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2 bg-gray-900/50 rounded">
              <h4 className="font-medium text-gray-400 mb-1">Direct Query {directResults?.count || 0}</h4>
              {directResults?.error ? (
                <div className="text-red-400">{directResults.error}</div>
              ) : directResults?.data?.length > 0 ? (
                <div className="text-[9px] space-y-1">
                  {directResults.data.map((order: any) => (
                    <div key={order.id} className="p-1 bg-gray-800 rounded flex justify-between">
                      <span className="font-mono">{order.order_number}</span>
                      <span className="text-gray-400">{order.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500">No orders found</div>
              )}
            </div>
            
            <div className="p-2 bg-gray-900/50 rounded">
              <h4 className="font-medium text-gray-400 mb-1">View Query {viewResults?.count || 0}</h4>
              {viewResults?.error ? (
                <div className="text-red-400">{viewResults.error}</div>
              ) : viewResults?.data?.length > 0 ? (
                <div className="text-[9px] space-y-1">
                  {viewResults.data.map((order: any) => (
                    <div key={order.id} className="p-1 bg-gray-800 rounded flex justify-between">
                      <span className="font-mono">{order.order_number}</span>
                      <span className="text-gray-400">{order.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500">No orders found</div>
              )}
            </div>
          </div>
          
          {jwtInfo && walletAddress && jwtInfo.wallet_address && jwtInfo.wallet_address !== walletAddress && (
            <div className="p-2 bg-red-900/20 rounded">
              <h4 className="font-medium text-red-400 mb-1">Wallet Address Mismatch</h4>
              <div className="text-[9px] space-y-1">
                <div className="grid grid-cols-[80px_1fr] gap-1">
                  <div className="text-gray-400">Connected:</div>
                  <div className="font-mono text-gray-300 break-all">{walletAddress}</div>
                  
                  <div className="text-gray-400">JWT Claims:</div>
                  <div className="font-mono text-gray-300 break-all">{jwtInfo.wallet_address || 'Missing'}</div>
                </div>
                <div className="text-red-300 mt-1">
                  This mismatch is likely causing orders to not appear in the view
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 