import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import type { Order, OrderTracking, ShippingAddress, ContactInfo, OrderVariant, ProductSnapshot, CollectionSnapshot, PaymentMetadata } from '../types/orders';

// Define the database row type for type safety
interface OrderRow {
  id: string;
  order_number: string;
  status: Order['status'];
  created_at: string;
  updated_at: string;
  product_id: string;
  collection_id: string;
  product_name: string;
  product_sku: string;
  collection_name: string;
  amount_sol: number;
  category_name: string;
  shipping_address: ShippingAddress;
  contact_info: ContactInfo;
  wallet_address: string;
  transaction_signature: string | null;
  variant_selections: OrderVariant[];
  product_snapshot: ProductSnapshot;
  collection_snapshot: CollectionSnapshot;
  payment_metadata: PaymentMetadata | null;
  tracking: OrderTracking | null;
}

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
      
      // Get JWT token debugging info
      const { data: jwtDebug, error: jwtError } = await supabase.rpc('debug_auth_jwt');
      console.log('JWT debug info:', jwtDebug || 'Not available');
      if (jwtError) {
        console.log('JWT debug error:', jwtError.message);
      }
      
      // Get comprehensive auth diagnostics (will be available after migration)
      try {
        const { data: diagnostics } = await supabase
          .from('debug_wallet_auth')
          .select('*')
          .single();
        
        if (diagnostics) {
          console.log('Auth diagnostics:', {
            jwt_claims: diagnostics.jwt_claims,
            extracted_wallet: diagnostics.extracted_wallet_address,
            direct_orders_count: diagnostics.direct_orders_count,
            view_orders_count: diagnostics.view_orders_count,
            all_wallets: diagnostics.all_wallets_with_orders
          });
        }
      } catch (diagError) {
        console.log('Diagnostic view not available yet:', diagError instanceof Error ? diagError.message : String(diagError));
      }
      
      // Try direct orders query first for comparison
      const { data: directOrders, error: directError } = await supabase
        .from('orders')
        .select('*')
        .eq('wallet_address', walletAddress);
      
      console.log('Direct orders query result:', { 
        count: directOrders?.length || 0, 
        error: directError ? directError.message : null 
      });

      // Use user_orders view instead of orders table to get tracking information
      const { data: initialData, error } = await supabase
        .from('user_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        setError(error.message);
      } else {
        // Track the data we'll use for mapping
        let orderData = initialData;
        
        // Add some debug logging to check if tracking data is being returned
        console.log('user_orders query results:', {
          count: orderData?.length || 0,
          firstOrder: orderData?.[0] ? {
            id: orderData[0].id,
            wallet: orderData[0].wallet_address,
            hasTracking: !!orderData[0].tracking
          } : null
        });
        
        // Log a warning if we have a mismatch between direct orders and view
        if (orderData.length === 0 && directOrders && directOrders.length > 0) {
          console.warn('Warning: Orders found in direct query but not in user_orders view. This may indicate an RLS issue or view configuration problem.');
          console.log('Wallet address used for query:', walletAddress);
        }
        
        // Convert database rows to Order objects
        const mappedOrders: Order[] = (orderData || []).map((row: OrderRow) => ({
          id: row.id,
          order_number: row.order_number,
          status: row.status,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          product_id: row.product_id,
          collection_id: row.collection_id,
          product_name: row.product_name,
          product_sku: row.product_sku,
          collection_name: row.collection_name,
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
          tracking: row.tracking
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