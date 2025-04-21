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
      
      // Check if wallet address is in JWT claims
      const walletAddressInJWT = sessionData?.session?.user?.user_metadata?.wallet_address;
      console.log('Wallet address in JWT claims:', walletAddressInJWT || 'Not found');
      console.log('Matches current wallet:', walletAddressInJWT === walletAddress ? 'Yes' : 'No');
      
      // Get JWT token debugging info - try but don't fail if not available
      try {
        // Try the direct JWT wallet info debug function first (more reliable)
        try {
          const { data: walletInfo } = await supabase.rpc('debug_jwt_wallet_info');
          console.log('Direct wallet info from JWT:', walletInfo);
          
          // Log whether wallet will be properly matched in the view
          if (walletInfo?.effective_wallet === walletAddress) {
            console.log('✅ JWT wallet matches connected wallet - view filtering should work');
          } else {
            console.log('❌ JWT wallet mismatch - view filtering may fail', {
              jwtWallet: walletInfo?.effective_wallet,
              connectedWallet: walletAddress
            });
          }
        } catch (e) {
          console.log('JWT wallet info not available yet');
          
          // Fall back to old debug function
          const { data: jwtDebug } = await supabase.rpc('debug_auth_jwt');
          console.log('Legacy JWT debug info:', jwtDebug || 'Not available');
        }
      } catch (jwtError) {
        console.log('JWT debug not available:', jwtError instanceof Error ? jwtError.message : String(jwtError));
      }
      
      // If wallet not in JWT, try syncing it
      if (sessionData?.session && walletAddressInJWT !== walletAddress) {
        console.log('Wallet address mismatch detected, trying to sync...');
        try {
          const { error: updateError } = await supabase.auth.updateUser({
            data: { wallet_address: walletAddress }
          });
          
          if (updateError) {
            console.error('Error updating wallet in JWT:', updateError.message);
          } else {
            console.log('Successfully updated wallet in JWT, will try fetching orders again');
            // Wait a moment for JWT update to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (syncError) {
          console.error('Error syncing wallet address:', syncError);
        }
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
        // Just log but don't fail - diagnostic view is optional
        console.log('Diagnostic view not available:', diagError instanceof Error ? diagError.message : String(diagError));
      }
      
      // Try direct orders query first
      const { data: directOrders, error: directError } = await supabase
        .from('orders')
        .select('*')
        .eq('wallet_address', walletAddress);
      
      console.log('Direct orders query result:', { 
        count: directOrders?.length || 0, 
        error: directError ? directError.message : null 
      });

      // Try the user_orders view - if it fails, we'll fall back to the direct query
      let orderData: any[] = [];
      let viewError = null;
      try {
        const { data, error } = await supabase
          .from('user_orders')
          .select('*')
          .order('created_at', { ascending: false });
          
        viewError = error;
        if (!error && data) {
          orderData = data;
          console.log('user_orders query results:', {
            count: orderData?.length || 0,
            firstOrder: orderData?.[0] ? {
              id: orderData[0].id,
              wallet: orderData[0].wallet_address,
              hasTracking: !!orderData[0].tracking
            } : null
          });
        }
      } catch (userOrdersError) {
        console.warn('Error querying user_orders view:', userOrdersError instanceof Error ? userOrdersError.message : String(userOrdersError));
        viewError = userOrdersError;
      }

      // If user_orders view failed or returned no results, fall back to direct query with manual tracking lookup
      if ((viewError || orderData.length === 0) && directOrders && directOrders.length > 0) {
        console.log('Using direct orders query as fallback');
        orderData = directOrders;
        
        // Try to get tracking information separately for each order
        try {
          for (const order of orderData) {
            const { data: trackingData } = await supabase
              .from('order_tracking')
              .select('*')
              .eq('order_id', order.id)
              .single();
              
            if (trackingData) {
              // Get tracking events if available
              const { data: events } = await supabase
                .from('tracking_events')
                .select('*')
                .eq('tracking_id', trackingData.id)
                .order('timestamp', { ascending: false });
                
              // Add tracking data to order object
              order.tracking = {
                ...trackingData,
                tracking_events: events || []
              };
            }
          }
          console.log('Added tracking data to direct orders');
        } catch (trackingError) {
          console.warn('Could not fetch tracking data:', trackingError instanceof Error ? trackingError.message : String(trackingError));
        }
      }
      
      // If we have an error with user_orders view but direct query was successful, don't report the error
      if (viewError && directOrders && directOrders.length > 0) {
        viewError = null;
      }

      if (viewError) {
        console.error('Error fetching orders:', viewError);
        setError(viewError instanceof Error ? viewError.message : String(viewError));
      } else {
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