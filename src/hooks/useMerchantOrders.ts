import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Order } from '../types/orders';

export function useMerchantOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .rpc('get_merchant_orders', {
          p_limit: 100,
          p_offset: 0
        });

      if (error) throw error;

      const transformedOrders: Order[] = (data || []).map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        product: {
          name: order.product_name,
          sku: order.product_sku,
          price: order.product_price,
          imageUrl: order.product_image,
          collection: order.collection_name ? {
            name: order.collection_name
          } : undefined,
          category: order.category_name ? {
            name: order.category_name
          } : undefined
        },
        variants: order.variants,
        shippingInfo: order.shipping_info,
        transactionId: order.transaction_id,
        transactionStatus: order.transaction_status,
        walletAddress: order.wallet_address,
        status: order.status,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at)
      }));

      setOrders(transformedOrders);
    } catch (err) {
      console.error('Error fetching merchant orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
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
      const { error } = await supabase.rpc('update_order_status', {
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

  return {
    orders,
    loading,
    error,
    refreshOrders: fetchOrders,
    updateOrderStatus
  };
}