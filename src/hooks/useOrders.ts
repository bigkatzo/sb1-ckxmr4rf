import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import type { Order, OrderTracking } from '../types/orders';

// Define the database row type for type safety
interface OrderRow {
  id: string;
  order_number: string;
  status: Order['status'];
  created_at: string;
  updated_at: string;
  product_id: string;
  collection_id: string;
  product_name: string;
  product_sku: string;
  collection_name: string;
  amount_sol: number;
  category_name: string;
  shipping_address: any;
  contact_info: any;
  wallet_address: string;
  transaction_signature: string;
  variant_selections: any[];
  product_snapshot: any;
  collection_snapshot: any;
  payment_metadata: any;
  tracking: OrderTracking | null;
}

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
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        setError(error.message);
      } else {
        setOrders(data || []);
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