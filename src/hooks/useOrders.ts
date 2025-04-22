import { useState, useEffect } from 'react';
import { supabase, AUTH_EXPIRED_EVENT } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import type { Order } from '../types/orders';
import { createClient } from '@supabase/supabase-js';

// This interface is no longer used since we're using joined queries with 'any' type
// We can safely remove it

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { walletAddress, isConnected, walletAuthToken } = useWallet();

  // Fetch orders when wallet changes or authentication status changes
  useEffect(() => {
    // SAFETY CHECK: Only proceed if wallet is currently connected
    if (!walletAddress || !isConnected) {
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
  }, [walletAddress, isConnected, walletAuthToken]);

  // Fetch orders function (extracted for reuse)
  const fetchOrders = async () => {
    try {
      // SAFETY CHECK: Only fetch if wallet is connected
      if (!walletAddress || !isConnected) {
        setOrders([]);
        setError("Wallet not connected");
        setLoading(false);
        return;
      }

      console.log('Fetching orders for wallet:', walletAddress);
      
      // If we have a wallet auth token, no need for the JWT sync logic
      if (!walletAuthToken) {
        console.log('No wallet auth token available. Orders may be restricted.');
        setOrders([]);
        setError("Wallet authentication required to view orders");
        setLoading(false);
        return;
      } else {
        console.log('Using wallet auth token for secure data access');
      }
      
      // SAFETY CHECK: Add final check before making API calls
      if (!walletAddress || !isConnected) {
        setOrders([]);
        setError("Wallet disconnected during operation");
        setLoading(false);
        return;
      }
      
      // First check the currently logged in user type
      const { data: sessionData } = await supabase.auth.getSession();
      const authType = sessionData?.session?.user?.app_metadata?.auth_type;
      console.log('Current auth type:', authType || 'standard');
      
      // Check what auth method to use - always use wallet auth flow with the token
      console.log('Using wallet auth flow to fetch orders');
      
      // Get Supabase URL and anon key from environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase URL or key not found in environment variables');
      }
      
      // Create a new client with auth token in headers
      const authClient = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: {
            Authorization: `Bearer ${walletAuthToken}`
          }
        }
      });
      
      // Use the client with auth token to query for orders
      const result = await authClient
        .from('user_orders')
        .select('*')
        .order('created_at', { ascending: false });
        
      // Log the raw response for debugging
      console.log('Raw wallet-verified query response:', {
        status: result.status,
        statusText: result.statusText,
        error: result.error,
        count: result.data?.length || 0,
        jwt: 'Using JWT token for secure database-level filtering'
      });
      
      const ordersData = result.data;
      const ordersError = result.error;
      
      // Debug: Log the received data to see what's coming back
      console.log('Orders data received:', { 
        hasData: !!ordersData, 
        dataLength: ordersData?.length || 0,
        firstItem: ordersData?.[0] || null,
        hasError: !!ordersError,
        errorMessage: ordersError?.message
      });
      
      if (ordersData && Array.isArray(ordersData) && ordersData.length > 0) {
        console.log('Orders query result:', { 
          count: ordersData.length,
          authMethod: 'wallet'  // Always wallet auth now
        });
        
        // Map the data to our Order objects based on the structure
        const mappedOrders: Order[] = ordersData.map((order: any) => {
          const isViewResult = 'product_name' in order;
          
          return {
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            createdAt: new Date(order.created_at),
            updatedAt: new Date(order.updated_at),
            product_id: order.product_id,
            collection_id: order.collection_id,
            // Handle both view format and direct query format
            product_name: isViewResult 
              ? order.product_name || ''
              : (order.products?.name || (order.product_snapshot?.name || '')),
            product_sku: isViewResult
              ? order.product_sku || ''
              : (order.products?.sku || (order.product_snapshot?.sku || '')),
            collection_name: isViewResult
              ? order.collection_name || ''
              : (order.collections?.name || (order.collection_snapshot?.name || '')),
            amountSol: order.amount_sol,
            category_name: order.category_name,
            shippingAddress: order.shipping_address,
            contactInfo: order.contact_info,
            walletAddress: order.wallet_address,
            transactionSignature: order.transaction_signature || undefined,
            variant_selections: order.variant_selections,
            product_snapshot: order.product_snapshot,
            collection_snapshot: order.collection_snapshot,
            payment_metadata: order.payment_metadata || undefined,
            tracking: isViewResult
              ? order.tracking
              : null // We'll fetch tracking separately if needed
          };
        });
        
        setOrders(mappedOrders);
        setError(null);
        return;
      }
      
      if (ordersError) {
        console.log('Error with orders query:', ordersError.message);
        
        // If we have a JWS invalid signature error, it's a token issue
        if (ordersError.message.includes('JWSInvalidSignature')) {
          // Try to handle JWS signature errors by requesting a new token
          window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
          setError("Authorization token error. Please reconnect your wallet.");
        } else {
          setError("Failed to fetch orders. Please make sure your wallet is connected.");
        }
        
        setOrders([]);
      } else if (!ordersData || !Array.isArray(ordersData)) {
        // Data exists but isn't an array (incorrect format)
        console.error('Orders data is not in expected format:', ordersData);
        setError("Invalid data format received from server");
        setOrders([]);
      } else if (ordersData.length === 0) {
        console.log('No orders found for this wallet address');
        setOrders([]);
        setError(null);
      } else {
        // This shouldn't happen - we should have caught valid orders earlier
        console.warn('Unexpected code path: valid orders exist but weren\'t processed');
        const simplifiedOrders = ordersData.map((order: any) => ({
          id: order.id || 'unknown-id',
          order_number: order.order_number || 'unknown',
          status: (order.status || 'pending_payment') as any,
          createdAt: new Date(order.created_at || Date.now()),
          updatedAt: new Date(order.updated_at || Date.now()),
          product_id: order.product_id || '',
          collection_id: order.collection_id || '',
          product_name: order.product_name || '',
          product_sku: order.product_sku || '',
          collection_name: order.collection_name || '',
          amountSol: order.amount_sol || 0,
          category_name: order.category_name || '',
          shippingAddress: order.shipping_address || {},
          contactInfo: order.contact_info || {},
          walletAddress: order.wallet_address || '',
          transactionSignature: order.transaction_signature,
          variant_selections: order.variant_selections || [],
          product_snapshot: order.product_snapshot || {},
          collection_snapshot: order.collection_snapshot || {},
          payment_metadata: order.payment_metadata,
          tracking: order.tracking || null
        }));
        setOrders(simplifiedOrders);
        setError(null);
      }
    } catch (err) {
      console.error('Exception fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Expose refresh function to manually trigger data refresh
  const refreshOrders = () => {
    // SAFETY CHECK: Only allow refresh if wallet is connected
    if (!walletAddress || !isConnected) {
      setError("Wallet not connected");
      return;
    }
    
    setLoading(true);
    fetchOrders();
  };

  return { orders, loading, error, refreshOrders };
}