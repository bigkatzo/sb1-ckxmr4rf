import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Order } from '../types/orders';

export function useOrders(walletAddress?: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!walletAddress) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          variants,
          shipping_info,
          transaction_id,
          transaction_status,
          wallet_address,
          status,
          created_at,
          updated_at,
          product:product_id (
            id,
            name,
            sku,
            price,
            images,
            collection:collection_id (
              name
            ),
            category:category_id (
              name
            )
          )
        `)
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedOrders: Order[] = (data || []).map(order => ({
        id: order.id,
        orderNumber: order.order_number,
        product: {
          name: order.product.name,
          sku: order.product.sku,
          price: order.product.price,
          imageUrl: order.product.images?.[0],
          collection: order.product.collection ? {
            name: order.product.collection.name
          } : undefined,
          category: order.product.category ? {
            name: order.product.category.name
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
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchOrders();

    // Set up realtime subscription
    const channel = supabase.channel('orders')
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