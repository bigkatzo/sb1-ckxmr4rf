import { useState, useEffect } from 'react';
import { supabase, AUTH_EXPIRED_EVENT } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import type { Order } from '../types/orders';
import { useSupabaseWithWallet } from './useSupabaseWithWallet';

// This interface is no longer used since we're using joined queries with 'any' type
// We can safely remove it

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { walletAddress, isConnected } = useWallet();
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
  }, [walletAddress, isConnected, isAuthenticated]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // Prefer using the auth client with RLS security
      if (authClient) {
        try {
          // First try to use the user_orders view which has RLS security
          const { data: viewData, error: viewError } = await authClient
            .from('user_orders')
            .select('*')
            .order('created_at', { ascending: false });
            
          // If the view query succeeded and returned data, use it
          if (!viewError && viewData && viewData.length > 0) {
            const formattedOrders = formatOrdersData(viewData);
            setOrders(formattedOrders);
            setError(null);
            setLoading(false);
            return;
          }
          
          // If the view didn't work, try a secure direct query
          // This will still be protected by RLS policies
          const { data, error: directError } = await authClient
            .from('orders')
            .select('*, products(name), collections(name)')
            .eq('wallet_address', walletAddress)
            .order('created_at', { ascending: false });
            
          if (directError) throw directError;
          
          if (data && data.length > 0) {
            const formattedOrders = formatOrdersData(data);
            setOrders(formattedOrders);
            setError(null);
            setLoading(false);
            return;
          }
          
          // If we got here with no errors but no data, it means the user has no orders
          if (!directError) {
            setOrders([]);
            setError(null);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn("Header-authenticated queries failed:", err);
          // Continue to fallback only if we couldn't get orders through secure means
        }
      }
      
      // LAST RESORT FALLBACK: Direct query 
      // SECURITY NOTE: This should still be protected by RLS policies if configured correctly
      // We're explicitly filtering by wallet_address for additional security
      console.warn("Using fallback query method - this should be rare");
      const { data, error: fallbackError } = await supabase
        .from('orders')
        .select('*, products(name), collections(name)')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });
      
      if (fallbackError) throw fallbackError;
      
      if (data) {
        const formattedOrders = formatOrdersData(data);
        setOrders(formattedOrders);
        setError(null);
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