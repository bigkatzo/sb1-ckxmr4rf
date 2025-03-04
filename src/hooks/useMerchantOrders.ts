import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeStorageUrl } from '../lib/storage';
import type { Order, ProductSnapshot, CollectionSnapshot } from '../types/orders';

// Cache admin status for 5 minutes
const ADMIN_CACHE_DURATION = 5 * 60 * 1000;

interface RawOrder {
  id: string;
  order_number: string;
  product_id: string | null;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  product_variants: { name: string; value: string }[];
  product_variant_prices: Record<string, number>;
  collection_id: string;
  collection_name: string;
  collection_owner_id: string | null;
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
  access_type: 'view' | 'edit' | 'owner' | 'admin' | null;
  product_snapshot: ProductSnapshot;
  collection_snapshot: CollectionSnapshot;
}

export function useMerchantOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Use useRef for per-user admin status caching
  const adminCacheRef = useRef<{ [key: string]: { isAdmin: boolean; timestamp: number } }>({});

  const checkAdminStatus = useCallback(async (userId: string) => {
    // Return cached value if still valid
    if (adminCacheRef.current[userId] && 
        Date.now() - adminCacheRef.current[userId].timestamp < ADMIN_CACHE_DURATION) {
      return adminCacheRef.current[userId].isAdmin;
    }

    try {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const isAdmin = profile?.role === 'admin';
      
      // Cache the result per user
      adminCacheRef.current[userId] = {
        isAdmin,
        timestamp: Date.now()
      };

      return isAdmin;
    } catch (err) {
      console.error('Error checking admin status:', err);
      return false;
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw authError || new Error('Not authenticated');
      }

      // Check admin status
      const adminStatus = await checkAdminStatus(user.id);
      setIsAdmin(adminStatus);

      const { data: rawOrders, error: fetchError } = await supabase
        .from('merchant_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform raw orders into the expected format
      const transformedOrders: Order[] = (rawOrders || []).map((order: RawOrder) => ({
        id: order.id,
        order_number: order.order_number,
        // Direct fields from orders table
        product_name: order.product_name,
        product_sku: order.product_sku,
        collection_name: order.collection_name,
        // Product and collection references
        product: order.product_id ? {
          id: order.product_id,
          imageUrl: order.product_image_url ? normalizeStorageUrl(order.product_image_url) : undefined,
          variants: order.product_variants || [],
          variantPrices: order.product_variant_prices || {},
          category: order.category_name ? {
            name: order.category_name,
            description: order.category_description || undefined,
            type: order.category_type || undefined
          } : undefined,
          collection: {
            id: order.collection_id,
            ownerId: order.collection_owner_id || undefined
          }
        } : undefined,
        product_snapshot: order.product_snapshot,
        collection_snapshot: order.collection_snapshot,
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
      }));

      setOrders(transformedOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch orders'));
    } finally {
      setLoading(false);
    }
  }, [checkAdminStatus]);

  useEffect(() => {
    fetchOrders();

    // Set up realtime subscription
    const channel = supabase.channel('merchant_orders')
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

  const updateOrderStatus = useCallback(async (orderId: string, status: Order['status']) => {
    try {
      // First, check if user has edit access to the order's collection
      const { data: orderData, error: orderError } = await supabase
        .from('merchant_orders')
        .select('collection_id, access_type')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('Order not found');

      // Only allow status update if user has edit access or is admin
      if (orderData.access_type !== 'edit' && !isAdmin) {
        throw new Error('You do not have permission to update this order');
      }

      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
    } catch (err) {
      console.error('Error updating order status:', err);
      throw err;
    }
  }, [isAdmin]);

  return {
    orders,
    loading,
    error,
    refreshOrders: fetchOrders,
    updateOrderStatus
  };
}