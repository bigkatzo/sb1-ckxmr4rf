import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Order } from '../types/orders';

interface RawOrder {
  id: string;
  product_id: string;
  collection_id: string;
  wallet_address: string;
  transaction_signature: string;
  shipping_address: any;
  contact_info: any;
  status: Order['status'];
  amount_sol: number;
  created_at: string;
  updated_at: string;
  product_name: string;
  product_sku: string;
  product_images: string[];
  collection_name: string;
  collection_owner_id: string;
  access_type: string | null;
}

export function useMerchantOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('merchant_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedOrders: Order[] = (data || []).map((order: RawOrder) => ({
        id: order.id,
        product: {
          id: order.product_id,
          name: order.product_name,
          sku: order.product_sku,
          imageUrl: order.product_images?.[0] || undefined,
          collection: {
            id: order.collection_id,
            name: order.collection_name,
            ownerId: order.collection_owner_id
          }
        },
        walletAddress: order.wallet_address,
        transactionSignature: order.transaction_signature,
        shippingAddress: order.shipping_address,
        contactInfo: order.contact_info,
        status: order.status,
        amountSol: order.amount_sol,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        accessType: order.access_type
      }));

      setOrders(transformedOrders);
    } catch (err) {
      console.error('Error fetching merchant orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    // Set up realtime subscription
    const channel = supabase.channel('merchant_orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
      await fetchOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      throw err;
    }
  };

  return {
    orders,
    loading,
    error,
    refreshOrders: fetchOrders,
    updateOrderStatus
  };
}