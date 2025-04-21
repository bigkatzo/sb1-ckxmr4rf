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
  const { walletAddress } = useWallet();

  // Fetch orders when wallet changes
  useEffect(() => {
    if (!walletAddress) {
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
  }, [walletAddress]);

  // Fetch orders function (extracted for reuse)
  const fetchOrders = async () => {
    try {
      console.log('Fetching orders for wallet:', walletAddress);
      
      // DEBUG: Check if JWT is present in auth
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('Current session:', sessionData?.session ? 'Found' : 'Not found');
      console.log('JWT token present:', sessionData?.session?.access_token ? 'Yes' : 'No');
      
      // If we have a session but JWT doesn't have our wallet address, sync it
      const walletAddressInJWT = sessionData?.session?.user?.user_metadata?.wallet_address;
      console.log('Wallet address in JWT claims:', walletAddressInJWT || 'Not found');
      console.log('Matches current wallet:', walletAddressInJWT === walletAddress ? 'Yes' : 'No');
      
      // Use the debug function to get more information about JWT structure
      try {
        const { data: jwtDebug } = await supabase.rpc('debug_jwt_wallet');
        if (jwtDebug) {
          console.log('JWT debug info:', jwtDebug);
        }
      } catch (e) {
        // Function might not exist, that's okay
        console.log('Debug function not available:', e instanceof Error ? e.message : String(e));
      }
      
      // Try to sync JWT if user is authenticated but wallet doesn't match
      if (sessionData?.session && walletAddressInJWT !== walletAddress) {
        console.log('Wallet address mismatch detected, updating JWT metadata...');
        try {
          // This is wallet-only auth mechanism - completely separate from merchant auth
          const { error: updateError } = await supabase.auth.updateUser({
            data: { 
              wallet_address: walletAddress,
              wallet_updated_at: new Date().toISOString()
            }
          });
          
          if (updateError) {
            console.error('Error updating wallet in JWT:', updateError.message);
          } else {
            console.log('Successfully updated wallet in JWT');
            // Wait a moment for JWT update to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try to sync using the RPC function if available
            try {
              const { data: syncResult } = await supabase.rpc('sync_wallet_to_jwt', {
                wallet_addr: walletAddress || ''
              });
              console.log('Wallet sync result:', syncResult);
            } catch (e) {
              // Function might not exist yet, ignore
            }
          }
        } catch (syncError) {
          console.error('Error syncing wallet address:', syncError);
        }
      }
      
      // First try the direct query - this should work with our new public RLS policy
      console.log('Trying direct query with wallet address:', walletAddress);
      const { data: directOrdersData, error: directError } = await supabase
        .from('orders')
        .select(`
          *,
          products:product_id(name, sku),
          collections:collection_id(name),
          tracking:order_tracking(*)
        `)
        .eq('wallet_address', walletAddress || '')
        .order('created_at', { ascending: false });
        
      if (!directError && directOrdersData && directOrdersData.length > 0) {
        console.log('Direct orders query result:', { 
          count: directOrdersData.length,
          hasTracking: directOrdersData.some(o => o.tracking && o.tracking.length > 0)
        });
        
        // Map the joined data to our Order objects
        const mappedOrders: Order[] = directOrdersData.map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          createdAt: new Date(order.created_at),
          updatedAt: new Date(order.updated_at),
          product_id: order.product_id,
          collection_id: order.collection_id,
          product_name: order.products?.name || 
                        (order.product_snapshot ? order.product_snapshot.name : ''),
          product_sku: order.products?.sku || 
                      (order.product_snapshot ? order.product_snapshot.sku : ''),
          collection_name: order.collections?.name || 
                          (order.collection_snapshot ? order.collection_snapshot.name : ''),
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
          tracking: order.tracking && order.tracking.length > 0 ? order.tracking[0] : null
        }));
        
        setOrders(mappedOrders);
        setError(null);
        return;
      }
      
      if (directError) {
        console.log('Error with direct orders query:', directError.message);
      } else if (directOrdersData?.length === 0) {
        console.log('No orders found for this wallet address');
        setOrders([]);
        setError(null);
        return;
      }
      
      // Try the authenticated user_orders view as a fallback
      console.log('Trying authenticated user_orders view...');
      const { data: viewOrdersData, error: viewError } = await supabase
        .from('user_orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!viewError && viewOrdersData && viewOrdersData.length > 0) {
        console.log('user_orders view result:', { 
          count: viewOrdersData.length,
          hasTracking: viewOrdersData.some(o => o.tracking)
        });
        
        // Convert view data to Order objects
        const mappedOrders: Order[] = viewOrdersData.map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          createdAt: new Date(order.created_at),
          updatedAt: new Date(order.updated_at),
          product_id: order.product_id,
          collection_id: order.collection_id,
          product_name: order.product_name || '',
          product_sku: order.product_sku || '',
          collection_name: order.collection_name || '',
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
          tracking: order.tracking
        }));
        
        setOrders(mappedOrders);
        setError(null);
      } else {
        // If we get here, no orders found by any method
        console.log('No orders found by any method:', viewError?.message || 'Empty result');
        setOrders([]);
        setError(null);
      }
    } catch (err) {
      console.error('Exception fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching orders');
    } finally {
      setLoading(false);
    }
  };

  // Expose refresh function to manually trigger data refresh
  const refreshOrders = () => {
    setLoading(true);
    fetchOrders();
  };

  return { orders, loading, error, refreshOrders };
}