import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import type { Order } from '../types/orders';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { walletAddress } = useWallet();

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Only fetch orders if wallet is connected
      if (!walletAddress) {
        setOrders([]);
        return;
      }

      const { data, error } = await supabase
        .from('user_orders')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedOrders: Order[] = (data || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        product_id: order.product_id,
        collection_id: order.collection_id,
        product_name: order.product_name,
        product_sku: order.product_sku,
        product_image_url: order.product_image_url,
        collection_name: order.collection_name,
        amountSol: order.amount_sol,
        category_name: order.category_name,
        shippingAddress: order.shipping_address,
        contactInfo: order.contact_info,
        walletAddress: order.wallet_address,
        transactionSignature: order.transaction_signature,
        access_type: order.access_type,
        order_variants: order.order_variants || []
      }));

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
    fetchOrders();

    // Set up realtime subscription for the specific wallet
    const channel = supabase.channel('user_orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `wallet_address=eq.${walletAddress}`
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchOrders, walletAddress]);

  return { 
    orders, 
    loading, 
    error, 
    refreshOrders: fetchOrders
  };
}