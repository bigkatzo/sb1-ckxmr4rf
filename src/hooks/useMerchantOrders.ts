import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeStorageUrl } from '../lib/storage';
import type { Order } from '../types/orders';

interface RawOrder {
  id: string;
  order_number: string;
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
  order_variants: { name: string; value: string }[];
  product_name: string;
  product_sku: string;
  product_image_url: string;
  product_variants: { name: string; value: string }[];
  product_variant_prices: Record<string, number>;
  collection_name: string;
  collection_owner_id: string;
  access_type: 'view' | 'edit' | null;
}

export function useMerchantOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('merchant_orders')
        .select('*');

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch orders'));
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
      // Get the order first to check access
      const { data: orderData, error: orderError } = await supabase
        .from('merchant_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Check if user has proper access (admin, owner, or edit access)
      if (!orderData.access_type || !['admin', 'owner', 'edit'].includes(orderData.access_type)) {
        throw new Error('You do not have permission to update this order');
      }

      // Call the RPC function to update the order status
      const { error } = await supabase
        .rpc('update_order_status', {
          p_order_id: orderId,
          p_status: status
        });

      if (error) throw error;
      await fetchOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      throw err;
    }
  };

  const canUpdateOrder = useCallback(async (order: Order) => {
    // Check if user has admin, owner, or edit access
    return order.accessType && ['admin', 'owner', 'edit'].includes(order.accessType);
  }, []);

  return {
    orders,
    loading,
    error,
    refreshOrders: fetchOrders,
    updateOrderStatus,
    canUpdateOrder
  };
}