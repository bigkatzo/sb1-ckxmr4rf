import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import type { Order } from '../types/orders';
import { getOrdersDirect } from '../utils/getOrdersDirect';

// This interface is no longer used since we're using joined queries with 'any' type
// We can safely remove it

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { walletAddress, walletAuthToken, isConnected, authenticated } = useWallet();

  // Fetch orders when wallet changes or authentication status changes
  useEffect(() => {
    // SAFETY CHECK: Only proceed if wallet is currently connected and authenticated via Privy
    if (!walletAddress || !isConnected || !authenticated) {
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
  }, [walletAddress, isConnected, authenticated, walletAuthToken]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // SAFETY CHECK: Ensure we have all the needed auth data
      if (!walletAddress || !walletAuthToken) {
        setError("Wallet authentication required");
        setOrders([]);
        setLoading(false);
        return;
      }

      // Use our direct fetch utility instead of Supabase SDK
      // This avoids the "h is not a function" error by using custom headers
      try {
        const result = await getOrdersDirect(walletAddress, walletAuthToken);
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        if (result.data) {
          // Log the raw data structure to debug what's coming from the API
          console.log('Raw order data structure:', {
            source: result.source,
            count: result.data.length,
            firstOrder: result.data.length > 0 ? {
              keys: Object.keys(result.data[0]),
              snapshot: result.data[0].product_snapshot,
              hasImages: result.data[0].product_snapshot?.images?.length > 0
            } : null,
            allProductSnapshots: result.data.map((order: any) => ({
              id: order.id,
              hasSnapshot: Boolean(order.product_snapshot),
              snapshotKeys: order.product_snapshot ? Object.keys(order.product_snapshot) : [],
              images: order.product_snapshot?.images || []
            }))
          });
          
          const formattedOrders = formatOrdersData(result.data);
          setOrders(formattedOrders);
          setError(null);
          
          // Log the source for debugging
          console.log(`Orders loaded successfully from: ${result.source}`);
          return;
        }
      } catch (directError) {
        console.error('Error with direct fetch approach:', directError);
        // Continue to fallback
      }
      
      // If direct fetch fails, try RPC fallback
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase URL or key not found');
        }
        
        const response = await fetch(
          `${supabaseUrl}/rest/v1/rpc/get_user_orders_fallback`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'X-Wallet-Address': walletAddress
            },
            body: JSON.stringify({ wallet_addr: walletAddress })
          }
        );
        
        if (!response.ok) {
          throw new Error(`RPC fallback failed: ${response.status}`);
        }
        
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const formattedOrders = formatOrdersData(data);
          setOrders(formattedOrders);
          setError(null);
          console.log('Orders loaded successfully from RPC fallback');
          return;
        } else {
          // If get_user_fallback returns empty, set a specific message to place an order
          console.log('No orders found from fallback, user should place an order');
          setOrders([]);
          setError('No orders found. Ready to place your first order!');
          return;
        }
      } catch (rpcError) {
        console.error('Error with RPC fallback:', rpcError);
      }
      
      // If we get here, both approaches failed
      setOrders([]);
      setError('Failed to fetch orders after multiple attempts');
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper to format orders data consistently
  const formatOrdersData = (data: any[]): Order[] => {
    // Log before and after for the first order to debug transformation issues
    if (data.length > 0) {
      console.log('First order before formatting:', data[0]);
    }
    
    const formatted = data.map(order => {
      // Check for string JSON in product_snapshot and parse it if needed
      let productSnapshot = order.product_snapshot;
      if (typeof productSnapshot === 'string') {
        try {
          productSnapshot = JSON.parse(productSnapshot);
        } catch (e) {
          console.error('Error parsing product_snapshot string:', e);
          productSnapshot = {};
        }
      }
      
      // Same for shipping_address, contact_info, variant_selections if they're strings
      let shippingAddress = order.shipping_address || order.shippingAddress;
      if (typeof shippingAddress === 'string') {
        try { shippingAddress = JSON.parse(shippingAddress); } 
        catch (e) { shippingAddress = {}; }
      }
      
      let contactInfo = order.contact_info || order.contactInfo;
      if (typeof contactInfo === 'string') {
        try { contactInfo = JSON.parse(contactInfo); } 
        catch (e) { contactInfo = {}; }
      }
      
      let variantSelections = order.variant_selections;
      if (typeof variantSelections === 'string') {
        try { variantSelections = JSON.parse(variantSelections); } 
        catch (e) { variantSelections = []; }
      }
      
      // Parse collection_snapshot if it's a string
      let collectionSnapshot = order.collection_snapshot;
      if (typeof collectionSnapshot === 'string') {
        try { collectionSnapshot = JSON.parse(collectionSnapshot); }
        catch (e) { collectionSnapshot = {}; }
      }
      
      // Convert column names from snake_case to camelCase if needed
      return {
        id: order.id || '',
        order_number: order.order_number || '',
        status: order.status || 'pending_payment',
        // Ensure we have product info, use empty strings if not available
        product_name: order.product_name || order.products?.name || '',
        collection_name: order.collection_name || order.collections?.name || '',
        product_id: order.product_id || order.productId || '',
        collection_id: order.collection_id || order.collectionId || '',
        product_sku: order.product_sku || order.productSku || '',
        category_name: order.category_name || '',
        // Ensure structured data is properly defaulted
        product_snapshot: productSnapshot || {},
        collection_snapshot: collectionSnapshot || {},
        shippingAddress: shippingAddress || {},
        contactInfo: contactInfo || {},
        variant_selections: variantSelections || [],
        // For fields that might be named with snake_case in the database response
        walletAddress: order.wallet_address || order.walletAddress || '',
        transactionSignature: order.transaction_signature || order.transactionSignature || '',
        amountSol: Number(order.amount_sol || order.amountSol || 0),
        amount: order.amount !== undefined ? Number(order.amount) : undefined,
        quantity: order.quantity !== undefined ? Number(order.quantity) : undefined,
        // Ensure dates are proper Date objects
        createdAt: new Date(order.created_at || order.createdAt || new Date()),
        updatedAt: new Date(order.updated_at || order.updatedAt || new Date()),
        // Set tracking to null if not available
        tracking: order.tracking || null,
        // Include batch order information
        batch_order_id: order.batch_order_id || undefined,
        item_index: order.item_index || undefined,
        total_items_in_batch: order.total_items_in_batch || undefined,
        // Add missing required fields
        user_id: order.user_id || order.userId || '',
        items: order.items || [],
        total: Number(order.total || 0),
        created_at: order.created_at || order.createdAt || new Date().toISOString(),
        updated_at: order.updated_at || order.updatedAt || new Date().toISOString(),
        shipping_address: order.shipping_address || order.shippingAddress || {
          name: '',
          email: '',
          address1: '',
          city: '',
          state: '',
          postal_code: '',
          country: ''
        },
        // Add optional fields with defaults
        payment_metadata: order.payment_metadata || undefined,
        access_type: order.access_type || undefined,
        product_image_url: order.product_image_url || undefined,
        order_variants: order.order_variants || undefined,
        product_variant_prices: order.product_variant_prices || undefined,
        status_history: order.status_history || undefined,
        notes: order.notes || undefined,
        custom_data: order.custom_data || null
      };
    });
    
    // Log the first transformed order
    if (formatted.length > 0) {
      console.log('First order after formatting:', formatted[0]);
    }
    
    return formatted;
  };

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders
  };
}