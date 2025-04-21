import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import type { Order } from '../types/orders';

// This interface is no longer used since we're using joined queries with 'any' type
// We can safely remove it

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { walletAddress } = useWallet();

  // Fetch orders when wallet changes
  useEffect(() => {
    if (!walletAddress) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchOrders();

    // Set up realtime subscription to order changes
    const orderSubscription = supabase
      .channel('orders-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `wallet_address=eq.${walletAddress}`
        },
        (payload) => {
          console.log(`Realtime update received for: ${payload.table}:${payload.new.id}`);
          
          // Refresh orders when changes detected
          fetchOrders();
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      supabase.removeChannel(orderSubscription);
    };
  }, [walletAddress]);

  // Fetch orders function (extracted for reuse)
  const fetchOrders = async () => {
    try {
      console.log('Fetching orders for wallet:', walletAddress);
      
      // DEBUG: Check if JWT is present in auth
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('Current session:', sessionData?.session ? 'Found' : 'Not found');
      console.log('JWT token present:', sessionData?.session?.access_token ? 'Yes' : 'No');
      
      // If we have a session but JWT doesn't have our wallet address, sync it
      const walletAddressInJWT = sessionData?.session?.user?.user_metadata?.wallet_address;
      console.log('Wallet address in JWT claims:', walletAddressInJWT || 'Not found');
      console.log('Matches current wallet:', walletAddressInJWT === walletAddress ? 'Yes' : 'No');
      
      if (sessionData?.session && walletAddressInJWT !== walletAddress) {
        console.log('Wallet address mismatch detected, updating JWT metadata...');
        try {
          // This is wallet-only auth mechanism - completely separate from merchant auth
          const { error: updateError } = await supabase.auth.updateUser({
            data: { 
              wallet_address: walletAddress,
              wallet_updated_at: new Date().toISOString()
            }
          });
          
          if (updateError) {
            console.error('Error updating wallet in JWT:', updateError.message);
          } else {
            console.log('Successfully updated wallet in JWT');
            // Wait a moment for JWT update to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (syncError) {
          console.error('Error syncing wallet address:', syncError);
        }
      }
      
      // Query orders table directly - RLS will handle the filtering by wallet
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          products:product_id (name, sku),
          collections:collection_id (name),
          tracking:order_tracking (*)
        `)
        .eq('wallet_address', walletAddress) // Explicit filter to ensure correct data
        .order('created_at', { ascending: false });
      
      if (orderError) {
        console.error('Error fetching orders:', orderError);
        setError(orderError.message);
      } else {
        console.log('Orders query result:', { 
          count: orderData?.length || 0, 
          first: orderData?.[0] ? {
            id: orderData[0].id,
            wallet: orderData[0].wallet_address
          } : null
        });
        
        // Convert database rows to Order objects
        const mappedOrders: Order[] = (orderData || []).map((row: any) => ({
          id: row.id,
          order_number: row.order_number,
          status: row.status,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          product_id: row.product_id,
          collection_id: row.collection_id,
          // Product and collection info from joins
          product_name: row.products?.name || row.product_name,
          product_sku: row.products?.sku || row.product_sku,
          collection_name: row.collections?.name || row.collection_name,
          // Other fields
          amountSol: row.amount_sol,
          category_name: row.category_name,
          shippingAddress: row.shipping_address,
          contactInfo: row.contact_info,
          walletAddress: row.wallet_address,
          transactionSignature: row.transaction_signature || undefined,
          variant_selections: row.variant_selections,
          product_snapshot: row.product_snapshot,
          collection_snapshot: row.collection_snapshot,
          payment_metadata: row.payment_metadata || undefined,
          tracking: row.tracking?.length ? row.tracking[0] : null
        }));
        
        setOrders(mappedOrders);
        setError(null);
      }
    } catch (err) {
      console.error('Exception fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching orders');
    } finally {
      setLoading(false);
    }
  };

  // Expose refresh function to manually trigger data refresh
  const refreshOrders = () => {
    setLoading(true);
    fetchOrders();
  };

  return { orders, loading, error, refreshOrders };
}