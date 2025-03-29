import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { toast } from 'react-toastify';
import type { Order, OrderStatus } from '../types/orders';
import { useMerchantDashboard, SUBSCRIPTION_TYPES, POLLING_INTERVALS } from './useMerchantDashboard';

interface UseMerchantOrdersOptions {
  initialPriority?: number;
  deferLoad?: boolean;
  elementRef?: React.RefObject<HTMLDivElement>;
}

export function useMerchantOrders(options: UseMerchantOrdersOptions = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(!options.deferLoad);
  const isFetchingRef = useRef(false);

  const fetchOrders = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      // Fetch orders directly from merchant_orders view
      // This view handles all access control through RLS
      const { data: ordersData, error: ordersError } = await supabase
        .from('merchant_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Transform the data to match the Order type
      const transformedOrders: Order[] = (ordersData || []).map(order => ({
        id: order.id,
        order_number: order.id.slice(0, 8).toUpperCase(), // Generate a short order number from the UUID
        collection_id: order.collection_id || '',
        product_id: order.product_id || '',
        walletAddress: order.wallet_address,
        transactionSignature: order.transaction_signature,
        shippingAddress: order.shipping_address,
        contactInfo: order.contact_info,
        status: order.status as OrderStatus,
        amountSol: order.amount_sol,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        product_name: order.product_name || '',
        product_sku: order.product_sku || '',
        product_image_url: order.product_image_url || '',
        collection_name: order.collection_name || '',
        access_type: order.access_type,
        order_variants: order.variant_selections || []
      }));

      setOrders(transformedOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      const errorMessage = handleError(err);
      toast.error(`Failed to load orders: ${errorMessage}`);
      setOrders([]);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Fetch orders on mount unless deferred
  useEffect(() => {
    if (!options.deferLoad) {
      fetchOrders();
    }
  }, [fetchOrders, options.deferLoad]);

  // Use polling for orders instead of realtime
  const { error, refresh } = useMerchantDashboard({
    ...options,
    tables: ['orders'],
    subscriptionId: 'merchant_orders',
    onDataChange: fetchOrders,
    type: SUBSCRIPTION_TYPES.POLLING,
    pollingInterval: POLLING_INTERVALS.ORDERS
  });

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
      toast.success('Order status updated successfully');
      // Refresh orders after status update
      await fetchOrders();
    } catch (err) {
      console.error('Error updating order status:', err);
      const errorMessage = handleError(err);
      toast.error(`Failed to update order status: ${errorMessage}`);
      throw err;
    }
  }, [fetchOrders]);

  return {
    orders,
    loading: isLoading,
    error,
    updateOrderStatus,
    refresh
  };
}