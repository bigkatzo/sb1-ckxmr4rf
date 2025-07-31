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

interface OrderError extends Error {
  message: string;
}

export function useMerchantOrders(options: UseMerchantOrdersOptions = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(!options.deferLoad);
  const [error, setError] = useState<OrderError | null>(null);
  const isFetchingRef = useRef(false);
  const isInitialLoadRef = useRef(!options.deferLoad);

  const fetchOrders = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    // Only show loading state on initial load
    if (isInitialLoadRef.current) {
      setIsLoading(true);
    }

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
        order_number: order.order_number,
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
        category_name: order.category_name || '',
        category_description: order.category_description || '',
        category_type: order.category_type || '',
        access_type: order.access_type,
        variant_selections: order.variant_selections || [],
        order_variants: order.order_variants || order.variant_selections || [],
        product_variants: order.product_variants || [],
        product_variant_prices: order.product_variant_prices || [],
        product_snapshot: order.product_snapshot || {},
        collection_snapshot: order.collection_snapshot || {},
        tracking: order.tracking || null,
        payment_metadata: order.payment_metadata || undefined,
        // Batch order information
        batch_order_id: order.batch_order_id || undefined,
        item_index: order.item_index || undefined,
        total_items_in_batch: order.total_items_in_batch || undefined,
        // Customization data
        custom_data: order.custom_data || null,
        // Required properties with default values
        user_id: order.user_id || '',
        items: order.items || [],
        total: order.total || 0,
        created_at: order.created_at,
        updated_at: order.updated_at,
        shipping_address: order.shipping_address || {
          name: '',
          email: '',
          address1: '',
          city: '',
          state: '',
          postal_code: '',
          country: ''
        }
      }));

      setOrders(transformedOrders);
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err as OrderError);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
      isInitialLoadRef.current = false;
    }
  }, []);

  // Fetch orders on mount unless deferred
  useEffect(() => {
    if (!options.deferLoad) {
      fetchOrders();
    }
  }, [fetchOrders, options.deferLoad]);

  // Use polling for orders instead of realtime
  useMerchantDashboard({
    ...options,
    tables: ['orders'],
    subscriptionId: 'merchant_orders',
    onDataChange: fetchOrders,
    type: SUBSCRIPTION_TYPES.POLLING,
    pollingInterval: POLLING_INTERVALS.ORDERS
  });

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    try {
      console.log(`Attempting to update order ${orderId} status to ${status}`);
      
      // First, get the order with collection info to verify permissions
      const { data: orderBefore, error: fetchError } = await supabase
        .from('merchant_orders')
        .select('id, status, collection_id, access_type')
        .eq('id', orderId)
        .single();
      
      if (fetchError) {
        console.error('Error fetching order:', fetchError);
        throw fetchError;
      }
      
      console.log('Order found with access:', {
        orderId,
        currentStatus: orderBefore?.status,
        newStatus: status,
        accessType: orderBefore?.access_type
      });
      
      // If not admin, owner, or edit, verify permissions
      if (!['admin', 'owner', 'edit'].includes(orderBefore.access_type)) {
        throw new Error('You do not have permission to update this order');
      }
      
      let updateResult;
      let updateError; 
      
      // For admins, use the direct update that was working before
      // For users with edit or owner access, use the merchant_update_order_status RPC
      if (orderBefore.access_type === 'admin') {
        // Original approach that works for admins
        const result = await supabase
          .from('orders')
          .update({ status: status })
          .eq('id', orderId)
          .select('id, status');
          
        updateResult = result.data;
        updateError = result.error;
        
        console.log('Admin update result:', {
          success: !updateError,
          updateResult,
          error: updateError
        });
      } else {
        // For non-admins (edit, owner), use the RPC function designed for merchant access
        const result = await supabase
          .rpc('merchant_update_order_status', { 
            p_order_id: orderId, 
            p_status: status 
          });
          
        updateResult = result.data;
        updateError = result.error;
        
        console.log('Merchant update result:', updateResult);
        
        // Check for RPC function success flag
        if (!updateError && updateResult && !updateResult.success) {
          console.error('Failed to update order status:', updateResult.message);
          throw new Error(updateResult.message || 'Update failed');
        }
      }
      
      if (updateError) {
        console.error('Database error updating order status:', updateError);
        throw updateError;
      }
      
      // Force reload orders
      await fetchOrders();
      
    } catch (err) {
      console.error('Error updating order status:', err);
      const errorMessage = handleError(err);
      toast.error(`Failed to update order status: ${errorMessage}`);
      throw err;
    }
  }, [fetchOrders]);

  // Expose fetchOrders as refreshOrders for consistency
  const refreshOrders = useCallback(async () => {
    try {
      await fetchOrders();
      toast.success('Orders refreshed successfully');
    } catch (err) {
      console.error('Error refreshing orders:', err);
      toast.error('Failed to refresh orders');
    }
  }, [fetchOrders]);

  return {
    orders,
    loading: isLoading,
    error,
    updateOrderStatus,
    refreshOrders
  };
}