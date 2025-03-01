import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import type { Order } from '../types/orders';

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
        .select(`
          *,
          product:products (
            id,
            name,
            sku,
            images,
            collection:collections (
              id,
              name
            )
          )
        `)
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedOrders: Order[] = (data || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        product: {
          id: order.product.id,
          name: order.product.name,
          imageUrl: order.product.images?.[0] || null,
          sku: order.product.sku,
          collection: {
            id: order.product.collection.id,
            name: order.product.collection.name
          }
        },
        walletAddress: order.wallet_address,
        transactionSignature: order.transaction_signature,
        shippingAddress: order.shipping_address,
        contactInfo: order.contact_info,
        status: order.status,
        amountSol: order.amount_sol,
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

    // Set up realtime subscription for the current wallet
    const channel = supabase.channel('user_orders')
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