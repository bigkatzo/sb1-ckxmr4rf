import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { toast } from 'react-toastify';
import type { Order } from '../types/orders';
import { useMerchantDashboard, SUBSCRIPTION_TYPES, POLLING_INTERVALS } from './useMerchantDashboard';

interface UseMerchantOrdersOptions {
  initialPriority?: number;
  deferLoad?: boolean;
  elementRef?: React.RefObject<HTMLDivElement>;
}

export function useMerchantOrders(options: UseMerchantOrdersOptions = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const FETCH_COOLDOWN = 2000; // 2 seconds cooldown between fetches

  const fetchOrders = useCallback(async () => {
    const now = Date.now();
    if (isFetchingRef.current || now - lastFetchTimeRef.current < FETCH_COOLDOWN) {
      return;
    }

    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    try {
      // Get orders directly from merchant_orders view
      const { data: ordersData, error: ordersError } = await supabase
        .from('merchant_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      const errorMessage = handleError(err);
      toast.error(`Failed to load orders: ${errorMessage}`);
      setOrders([]);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Use realtime for orders with optimized subscription handling
  const { loading, error, refresh } = useMerchantDashboard({
    ...options,
    tables: ['orders'], // Only subscribe to orders table
    subscriptionId: 'merchant_orders',
    onDataChange: fetchOrders,
    type: SUBSCRIPTION_TYPES.REALTIME,
    pollingInterval: POLLING_INTERVALS.ORDERS,
    maxRetries: 3 // Limit retry attempts
  });

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    try {
      const { error } = await supabase.rpc('update_order_status', {
        p_order_id: orderId,
        p_status: status
      });

      if (error) throw error;
      toast.success('Order status updated successfully');
      await fetchOrders(); // Refresh orders after update
    } catch (err) {
      console.error('Error updating order status:', err);
      const errorMessage = handleError(err);
      toast.error(`Failed to update order status: ${errorMessage}`);
      throw err;
    }
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    updateOrderStatus,
    refresh
  };
}