import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import type { Order } from '../types/orders';

// This interface is no longer used since we're using joined queries with 'any' type
// We can safely remove it

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { walletAddress, isConnected, walletAuthToken } = useWallet();

  // Fetch orders when wallet changes or authentication status changes
  useEffect(() => {
    // SAFETY CHECK: Only proceed if wallet is currently connected
    if (!walletAddress || !isConnected) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchOrders();

    // Set up realtime subscription to order changes
    const orderSubscription = supabase
      .channel('orders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `wallet_address=eq.${walletAddress}`
        },
        (payload) => {
          console.log(`Realtime update received for: ${payload.table}:${payload.new.id}`);
          
          // Refresh orders when changes detected
          fetchOrders();
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      supabase.removeChannel(orderSubscription);
    };
  }, [walletAddress, isConnected, walletAuthToken]);

  // Fetch orders function (extracted for reuse)
  const fetchOrders = async () => {
    try {
      // SAFETY CHECK: Only fetch if wallet is connected
      if (!walletAddress || !isConnected) {
        setOrders([]);
        setError("Wallet not connected");
        setLoading(false);
        return;
      }

      console.log('Fetching orders for wallet:', walletAddress);
      
      // If we have a wallet auth token, no need for the JWT sync logic
      if (!walletAuthToken) {
        console.log('No wallet auth token available. Orders may be restricted.');
      } else {
        console.log('Using wallet auth token for secure data access');
      }
      
      // SAFETY CHECK: Add final check before making API calls
      if (!walletAddress || !isConnected) {
        setOrders([]);
        setError("Wallet disconnected during operation");
        setLoading(false);
        return;
      }
      
      // First check the currently logged in user type
      const { data: sessionData } = await supabase.auth.getSession();
      const authType = sessionData?.session?.user?.app_metadata?.auth_type;
      console.log('Current auth type:', authType || 'standard');
      
      // Check if the token is our custom wallet JWT
      const isCustomWalletJWT = walletAuthToken && walletAuthToken.includes('WALLET_AUTH_SIGNATURE');
      
      // Check what auth method to use
      const isWalletAuth = authType === 'wallet' || Boolean(walletAuthToken);
      
      let ordersData;
      let ordersError;
      
      if (isWalletAuth) {
        // For wallet-authenticated users, use the user_orders view
        // The RLS on the underlying orders table will filter data automatically
        console.log('Using wallet auth flow to fetch orders');
        
        // If we're using our custom JWT or test token, add it to the auth header
        if (isCustomWalletJWT || walletAuthToken === 'test-token-123') {
          console.log('Using wallet-verified query with user_orders view...');
          
          // For simplified wallet auth, we need to first set the session token
          // This is the most reliable way to ensure the token is used for auth
          if (walletAuthToken) {
            try {
              // Set the auth token in session before making the query
              await supabase.auth.setSession({
                access_token: walletAuthToken,
                refresh_token: ''
              });
              console.log('Set wallet auth token for this request');
            } catch (err) {
              console.error('Error setting wallet auth token:', err);
            }
          }
          
          // Then query the user_orders view which will use the token we just set
          const result = await supabase
            .from('user_orders')
            .select('*')
            .order('created_at', { ascending: false });
            
          console.log('Raw wallet-verified query response:', {
            status: result.status,
            statusText: result.statusText,
            error: result.error,
            count: result.data?.length || 0
          });
          
          ordersData = result.data;
          ordersError = result.error;
        } else {
          // Standard wallet auth token flow (if using real Supabase JWT)
          // If we have a wallet auth token, set it for this request only
          if (walletAuthToken && !sessionData?.session) {
            console.log('Setting wallet auth token:', walletAuthToken.substring(0, 10) + '...');
            
            try {
              const sessionResult = await supabase.auth.setSession({
                access_token: walletAuthToken,
                refresh_token: ''
              });
              
              if (sessionResult.error) {
                console.error('Error setting wallet auth token:', sessionResult.error);
              } else {
                console.log('Successfully set wallet auth token in session');
                
                // Verify the token was set by checking the session again
                const { data: verifySession } = await supabase.auth.getSession();
                console.log('Session after setting token:', 
                  verifySession?.session ? 'Session exists' : 'No session',
                  'Auth type:', verifySession?.session?.user?.app_metadata?.auth_type || 'not set',
                  'User ID:', verifySession?.session?.user?.id || 'not set'
                );
              }
            } catch (tokenError) {
              console.error('Exception setting wallet auth token:', tokenError);
            }
          } else if (!walletAuthToken) {
            console.warn('No wallet auth token available, but wallet auth flow requested');
          } else {
            console.log('Session already exists, not setting wallet auth token');
          }
          
          // After setting the token, proceed with the query
          console.log('Executing query with wallet auth...');
          const result = await supabase
            .from('user_orders')
            .select('*')
            .order('created_at', { ascending: false });
            
          // Log the raw response for debugging
          console.log('Raw query response:', {
            status: result.status,
            statusText: result.statusText,
            error: result.error,
            count: result.data?.length || 0
          });
            
          ordersData = result.data;
          ordersError = result.error;
        }
      } else {
        // For unauthenticated users, we no longer allow access to orders
        console.log('Wallet auth required to access orders');
        setOrders([]);
        setError("Wallet authentication required to view orders");
        setLoading(false);
        return;
      }
      
      if (!ordersError && ordersData && ordersData.length > 0) {
        console.log('Orders query result:', { 
          count: ordersData.length,
          authMethod: 'wallet'  // Always wallet auth now
        });
        
        // Map the data to our Order objects based on the structure
        const mappedOrders: Order[] = ordersData.map((order: any) => {
          const isViewResult = 'product_name' in order;
          
          return {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            createdAt: new Date(order.created_at),
            updatedAt: new Date(order.updated_at),
            product_id: order.product_id,
            collection_id: order.collection_id,
            // Handle both view format and direct query format
            product_name: isViewResult 
              ? order.product_name || ''
              : (order.products?.name || (order.product_snapshot?.name || '')),
            product_sku: isViewResult
              ? order.product_sku || ''
              : (order.products?.sku || (order.product_snapshot?.sku || '')),
            collection_name: isViewResult
              ? order.collection_name || ''
              : (order.collections?.name || (order.collection_snapshot?.name || '')),
            amountSol: order.amount_sol,
            category_name: order.category_name,
            shippingAddress: order.shipping_address,
            contactInfo: order.contact_info,
            walletAddress: order.wallet_address,
            transactionSignature: order.transaction_signature || undefined,
            variant_selections: order.variant_selections,
            product_snapshot: order.product_snapshot,
            collection_snapshot: order.collection_snapshot,
            payment_metadata: order.payment_metadata || undefined,
            tracking: isViewResult
              ? order.tracking
              : null // We'll fetch tracking separately if needed
          };
        });
        
        setOrders(mappedOrders);
        setError(null);
        return;
      }
      
      if (ordersError) {
        console.log('Error with orders query:', ordersError.message);
        setError("Failed to fetch orders. Please make sure your wallet is connected.");
        setOrders([]);
      } else {
        console.log('No orders found for this wallet address');
        setOrders([]);
        setError(null);
      }
    } catch (err) {
      console.error('Exception fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Expose refresh function to manually trigger data refresh
  const refreshOrders = () => {
    // SAFETY CHECK: Only allow refresh if wallet is connected
    if (!walletAddress || !isConnected) {
      setError("Wallet not connected");
      return;
    }
    
    setLoading(true);
    fetchOrders();
  };

  return { orders, loading, error, refreshOrders };
}