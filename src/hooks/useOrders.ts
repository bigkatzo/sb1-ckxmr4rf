import { useState, useEffect } from 'react';
import { supabase, AUTH_EXPIRED_EVENT } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import type { Order } from '../types/orders';
import { useSupabaseWithWallet } from './useSupabaseWithWallet';
import { getOrdersDirect } from '../utils/getOrdersDirect';

// This interface is no longer used since we're using joined queries with 'any' type
// We can safely remove it

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { walletAddress, walletAuthToken, isConnected } = useWallet();
  const { client: authClient, isAuthenticated } = useSupabaseWithWallet();

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
  }, [walletAddress, isConnected, isAuthenticated, walletAuthToken]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // SAFETY CHECK: Ensure we have all the needed auth data
      if (!walletAddress || !walletAuthToken) {
        setError("Wallet authentication required");
        setOrders([]);
        setLoading(false);
        return;
      }

      // Use our direct fetch utility instead of Supabase SDK
      // This avoids the "h is not a function" error by using custom headers
      const result = await getOrdersDirect(walletAddress, walletAuthToken);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (result.data) {
        const formattedOrders = formatOrdersData(result.data);
        setOrders(formattedOrders);
        setError(null);
        
        // Log the source for debugging
        console.log(`Orders loaded successfully from: ${result.source}`);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper to format orders data consistently
  const formatOrdersData = (data: any[]): Order[] => {
    return data.map(order => ({
      ...order,
      product_name: order.products?.name || order.product_name || '',
      collection_name: order.collections?.name || order.collection_name || '',
      // Ensure dates are proper Date objects
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
    }));
  };

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders
  };
}