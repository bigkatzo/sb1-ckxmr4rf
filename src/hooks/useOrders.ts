import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import type { Order, ProductSnapshot, CollectionSnapshot } from '../types/orders';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { walletAddress } = useWallet();

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Only fetch orders if wallet is connected
      if (!walletAddress) {
        setOrders([]);
        return;
      }

      const { data, error } = await supabase
        .from('user_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedOrders: Order[] = (data || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        product: order.product_id ? {
          id: order.product_id,
          name: order.product_name,
          imageUrl: order.product_images?.[0] || null,
          sku: order.product_sku,
          variants: order.product_variants || [],
          variantPrices: order.product_variant_prices || {},
          category: order.category_name ? {
            name: order.category_name
          } : undefined,
          collection: {
            id: order.collection_id,
            name: order.collection_name
          }
        } : undefined,
        product_snapshot: order.product_snapshot as ProductSnapshot,
        collection_snapshot: order.collection_snapshot as CollectionSnapshot,
        walletAddress: order.wallet_address,
        transactionSignature: order.transaction_signature,
        shippingAddress: order.shipping_address,
        contactInfo: order.contact_info,
        status: order.status,
        amountSol: order.amount_sol,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        order_variants: order.order_variants || []
      }));

      setOrders(transformedOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchOrders();

    // Set up realtime subscription
    const channel = supabase.channel('user_orders')
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

  return { 
    orders, 
    loading, 
    error, 
    refreshOrders: fetchOrders
  };
}