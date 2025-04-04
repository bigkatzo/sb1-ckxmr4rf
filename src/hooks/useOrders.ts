import { useState, useEffect, useCallback } from 'react';
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

  const fetchOrders = useCallback(async () => {
    try {
      console.log('Fetching orders, wallet address:', walletAddress);
      setLoading(true);
      setError(null);

      // Only fetch orders if wallet is connected
      if (!walletAddress) {
        console.log('No wallet address, clearing orders');
        setOrders([]);
        return;
      }

      const { data, error } = await supabase
        .from('user_orders')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .throwOnError();

      console.log('Orders query result:', { data, error });

      if (error) throw error;

      const transformedOrders: Order[] = (data as OrderRow[] || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        product_id: order.product_id,
        collection_id: order.collection_id,
        product_name: order.product_name,
        product_sku: order.product_sku,
        collection_name: order.collection_name,
        amountSol: order.amount_sol,
        category_name: order.category_name,
        shippingAddress: order.shipping_address,
        contactInfo: order.contact_info,
        walletAddress: order.wallet_address,
        transactionSignature: order.transaction_signature,
        variant_selections: order.variant_selections || [],
        product_snapshot: order.product_snapshot,
        collection_snapshot: order.collection_snapshot,
        payment_metadata: order.payment_metadata,
        tracking: order.tracking
      }));

      console.log('Transformed orders:', transformedOrders);
      setOrders(transformedOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void fetchOrders();

    // Set up realtime subscription for the specific wallet
    const channel = supabase.channel('user_orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_orders',
          filter: `wallet_address=eq.${walletAddress}`
        },
        () => {
          void fetchOrders();
        }
      )
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [fetchOrders, walletAddress]);

  return { 
    orders, 
    loading, 
    error, 
    refreshOrders: fetchOrders
  };
}