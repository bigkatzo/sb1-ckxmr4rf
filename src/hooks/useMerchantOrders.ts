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

  const fetchOrders = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw authError || new Error('Not authenticated');
      }

      // Get user's collections
      const { data: collections, error: collectionsError } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', user.id);

      if (collectionsError) throw collectionsError;

      // Get collections user has access to
      const { data: accessibleCollections, error: accessError } = await supabase
        .from('collection_access')
        .select('collection_id')
        .eq('user_id', user.id);

      if (accessError) throw accessError;

      // Combine collection IDs
      const collectionIds = [
        ...(collections?.map(c => c.id) || []),
        ...(accessibleCollections?.map(c => c.collection_id) || [])
      ];

      if (!collectionIds.length) {
        setOrders([]);
        return;
      }

      // Get orders for all collections
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          products:order_products (
            *,
            product:products (
              *,
              collection:collections (name)
            )
          )
        `)
        .in('collection_id', collectionIds)
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

  // Use realtime for orders with a backup polling strategy
  const { loading, error, refresh } = useMerchantDashboard({
    ...options,
    tables: ['orders', 'order_status'], // Only subscribe to critical tables
    subscriptionId: 'merchant_orders',
    onDataChange: fetchOrders,
    type: SUBSCRIPTION_TYPES.REALTIME, // Use realtime for immediate order updates
    pollingInterval: POLLING_INTERVALS.ORDERS // Fallback polling every 30s
  });

  const updateOrderStatus = useCallback(async (orderId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('order_status')
        .upsert({
          order_id: orderId,
          status
        });

      if (error) throw error;
      toast.success('Order status updated successfully');
    } catch (err) {
      console.error('Error updating order status:', err);
      const errorMessage = handleError(err);
      toast.error(`Failed to update order status: ${errorMessage}`);
      throw err;
    }
  }, []);

  return {
    orders,
    loading,
    error,
    updateOrderStatus,
    refresh
  };
}