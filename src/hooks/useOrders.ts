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
      
      // Use the authenticated client for all queries
      // The RLS policy will ensure only the wallet owner can access their data
      const { data: directOrdersData, error: directError } = await supabase
        .from('orders')
        .select(`
          *,
          products:product_id(name, sku),
          collections:collection_id(name),
          tracking:order_tracking(*)
        `)
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });
        
      if (!directError && directOrdersData && directOrdersData.length > 0) {
        console.log('Orders query result:', { 
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
        console.log('Error with orders query:', directError.message);
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