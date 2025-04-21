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
      
      // Try the user_orders view first - this should work with our RLS and view setup
      const { data: viewOrdersData, error: viewError } = await supabase
        .from('user_orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If view query failed, we'll try the direct fallback approach
      if (viewError || !viewOrdersData || viewOrdersData.length === 0) {
        console.log(`${viewError ? 'Error with' : 'No results from'} user_orders view, using fallback approach`);
        
        if (viewError) {
          console.warn('View error:', viewError.message);
        }
        
        // Use our proven fallback with direct queries
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('wallet_address', walletAddress)
          .order('created_at', { ascending: false });
        
        if (ordersError) {
          console.error('Error fetching orders:', ordersError);
          setError(ordersError.message);
          return;
        }
        
        console.log('Direct orders query result:', { 
          count: ordersData?.length || 0
        });
        
        // If we have orders, get related data separately
        if (ordersData && ordersData.length > 0) {
          // Get product details for these orders
          const productIds = [...new Set(ordersData.map(order => order.product_id))];
          const { data: productsData } = await supabase
            .from('products')
            .select('id, name, sku')
            .in('id', productIds);
          
          // Get collection details
          const collectionIds = [...new Set(ordersData.map(order => order.collection_id))];
          const { data: collectionsData } = await supabase
            .from('collections')
            .select('id, name')
            .in('id', collectionIds);
            
          // Get tracking data
          const orderIds = ordersData.map(order => order.id);
          const { data: trackingData } = await supabase
            .from('order_tracking')
            .select('*')
            .in('order_id', orderIds);
          
          // Create lookup maps for faster access
          const productsMap: Record<string, any> = (productsData || []).reduce((map: Record<string, any>, product) => {
            map[product.id] = product;
            return map;
          }, {});
          
          const collectionsMap: Record<string, any> = (collectionsData || []).reduce((map: Record<string, any>, collection) => {
            map[collection.id] = collection;
            return map;
          }, {});
          
          const trackingMap: Record<string, any> = (trackingData || []).reduce((map: Record<string, any>, tracking) => {
            map[tracking.order_id] = tracking;
            return map;
          }, {});
          
          // Convert database rows to Order objects
          const mappedOrders: Order[] = ordersData.map((order: any) => ({
            id: order.id,
            order_number: order.order_number,
            status: order.status,
            createdAt: new Date(order.created_at),
            updatedAt: new Date(order.updated_at),
            product_id: order.product_id,
            collection_id: order.collection_id,
            // Product and collection info from lookup maps
            product_name: productsMap[order.product_id]?.name || 
                          (order.product_snapshot ? order.product_snapshot.name : ''),
            product_sku: productsMap[order.product_id]?.sku || 
                        (order.product_snapshot ? order.product_snapshot.sku : ''),
            collection_name: collectionsMap[order.collection_id]?.name || 
                            (order.collection_snapshot ? order.collection_snapshot.name : ''),
            // Other fields
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
            tracking: trackingMap[order.id] || null
          }));
          
          setOrders(mappedOrders);
          setError(null);
        } else {
          // No orders found
          setOrders([]);
          setError(null);
        }
      } else {
        // user_orders view query succeeded - use that data
        console.log('user_orders view result:', { 
          count: viewOrdersData.length,
          hasTracking: viewOrdersData.some(o => o.tracking)
        });
        
        // Convert view data to Order objects
        const mappedOrders: Order[] = viewOrdersData.map((order: any) => ({
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          createdAt: new Date(order.created_at),
          updatedAt: new Date(order.updated_at),
          product_id: order.product_id,
          collection_id: order.collection_id,
          product_name: order.product_name || '',
          product_sku: order.product_sku || '',
          collection_name: order.collection_name || '',
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
          tracking: order.tracking
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