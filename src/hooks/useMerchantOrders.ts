import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeStorageUrl } from '../lib/storage';
import type { Order } from '../types/orders';

interface RawOrder {
  id: string;
  order_number: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  product_variants: { name: string; value: string }[];
  product_variant_prices: Record<string, number>;
  collection_id: string;
  collection_name: string;
  collection_owner_id: string;
  category_name: string | null;
  category_description: string | null;
  category_type: string | null;
  wallet_address: string;
  transaction_signature: string;
  shipping_address: any;
  contact_info: any;
  status: Order['status'];
  amount_sol: number;
  created_at: string;
  updated_at: string;
  variant_selections: { name: string; value: string }[];
  access_type: 'view' | 'edit' | null;
}

export function useMerchantOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const { data: rawOrders, error } = await supabase
        .from('merchant_orders')
        .select('*')
        .not('access_type', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform raw orders into the expected format
      const transformedOrders: Order[] = (rawOrders || []).map((order: RawOrder) => {
        return {
          id: order.id,
          order_number: order.order_number,
          product: {
            id: order.product_id,
            name: order.product_name,
            sku: order.product_sku || undefined,
            imageUrl: order.product_image_url ? normalizeStorageUrl(order.product_image_url) : undefined,
            variants: order.product_variants || [],
            variantPrices: order.product_variant_prices || {},
            collection: {
              id: order.collection_id,
              name: order.collection_name,
              ownerId: order.collection_owner_id
            },
            category: order.category_name ? {
              name: order.category_name,
              description: order.category_description || undefined,
              type: order.category_type || undefined
            } : undefined
          },
          walletAddress: order.wallet_address,
          transactionSignature: order.transaction_signature,
          shippingAddress: order.shipping_address,
          contactInfo: order.contact_info,
          status: order.status,
          amountSol: order.amount_sol,
          createdAt: new Date(order.created_at),
          updatedAt: new Date(order.updated_at),
          order_variants: order.variant_selections || [],
          accessType: order.access_type
        };
      });

      setOrders(transformedOrders);
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
          table: 'merchant_orders'
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