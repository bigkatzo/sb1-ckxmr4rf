import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Order } from '../types/orders';

export function useMerchantOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('merchant_orders')
        .select('*')
        .order('created_at', { ascending: false });

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

  return {
    orders,
    loading,
    error,
    refreshOrders: fetchOrders,
    updateOrderStatus
  };
}