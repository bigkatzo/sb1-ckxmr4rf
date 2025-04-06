import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { OrderList } from '../../components/merchant/OrderList';
import { OrderFilters } from '../../components/merchant/OrderFilters';
import { useMerchantOrders } from '../../hooks/useMerchantOrders';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { toast } from 'react-toastify';
import type { OrderStatus } from '../../types/orders';
import { Loading, LoadingType } from '../../components/ui/LoadingStates';
import { supabase } from '../../lib/supabase';

export function OrdersTab() {
  const { orders, loading, error, refreshOrders, updateOrderStatus } = useMerchantOrders();
  const { collections } = useMerchantCollections();
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<OrderStatus[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique products from filtered orders
  const products = React.useMemo(() => {
    const productsMap = new Map();
    
    orders.forEach(order => {
      // Skip if no product id
      if (!order?.product_id) return;
      
      // Only add products if no collections are selected or if they belong to one of the selected collections
      if (selectedCollections.length === 0 || selectedCollections.includes(order.collection_id)) {
        productsMap.set(order.product_id, {
          id: order.product_id,
          name: order.product_name
        });
      }
    });

    return Array.from(productsMap.values());
  }, [orders, selectedCollections]);

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, status);
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const handleTrackingUpdate = async (orderId: string, trackingNumber: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ tracking_number: trackingNumber })
        .eq('id', orderId);

      if (error) throw error;

      // Wait for the refresh to complete before returning
      await refreshOrders();
    } catch (error) {
      console.error('Error updating tracking number:', error);
      throw error;
    }
  };

  // Determine the payment method of an order
  const getPaymentMethod = (order: typeof orders[0]): string => {
    if (order.payment_metadata?.paymentMethod === 'stripe') {
      return 'stripe';
    }
    // If it's not stripe, assume it's a Solana payment
    // This could be refined further if there are other payment methods
    return 'solana';
  };

  // Filter orders based on selected collections, products, statuses, and payment methods
  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      // Filter by collections if any are selected
      if (selectedCollections.length > 0 && !selectedCollections.includes(order.collection_id)) {
        return false;
      }

      // Filter by products if any are selected
      if (selectedProducts.length > 0 && !selectedProducts.includes(order.product_id)) {
        return false;
      }

      // Filter by statuses if any are selected
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(order.status)) {
        return false;
      }

      // Filter by payment methods if any are selected
      if (selectedPaymentMethods.length > 0) {
        const paymentMethod = getPaymentMethod(order);
        if (!selectedPaymentMethods.includes(paymentMethod)) {
          return false;
        }
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          order.order_number?.toLowerCase().includes(query) ||
          order.product_name?.toLowerCase().includes(query) ||
          order.collection_name?.toLowerCase().includes(query) ||
          (order.tracking?.tracking_number?.toLowerCase().includes(query) || false) ||
          order.payment_metadata?.couponCode?.toLowerCase().includes(query) ||
          order.contactInfo?.phoneNumber?.toLowerCase().includes(query) ||
          order.contactInfo?.fullName?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [orders, selectedCollections, selectedProducts, selectedStatuses, selectedPaymentMethods, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading type={LoadingType.PAGE} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Error loading orders. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Orders</h2>
            <RefreshButton onRefresh={refreshOrders} />
          </div>
        </div>

        <OrderFilters
          collections={collections}
          products={products}
          selectedCollections={selectedCollections}
          selectedProducts={selectedProducts}
          selectedStatuses={selectedStatuses}
          selectedPaymentMethods={selectedPaymentMethods}
          searchQuery={searchQuery}
          onCollectionChange={setSelectedCollections}
          onProductChange={setSelectedProducts}
          onStatusChange={setSelectedStatuses}
          onPaymentMethodChange={setSelectedPaymentMethods}
          onSearchChange={setSearchQuery}
        />
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-center gap-3">
          <Package className="h-5 w-5 text-gray-400" />
          <p className="text-gray-400 text-sm">No orders found.</p>
        </div>
      ) : (
        <OrderList
          orders={filteredOrders}
          onStatusUpdate={handleStatusUpdate}
          onTrackingUpdate={handleTrackingUpdate}
        />
      )}
    </div>
  );
}