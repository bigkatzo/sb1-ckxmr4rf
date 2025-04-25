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
import { addTracking, deleteTracking } from '../../services/tracking';

export function OrdersTab() {
  const { orders, loading, error, refreshOrders, updateOrderStatus } = useMerchantOrders();
  const { collections } = useMerchantCollections();
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<OrderStatus[]>(['confirmed', 'shipped', 'delivered']);
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

  const handleTrackingUpdate = async (orderId: string, trackingNumber: string, carrier: string = '') => {
    try {
      console.log(`OrdersTab: Updating tracking for order ${orderId}: ${trackingNumber ? trackingNumber : '(empty)'}, carrier: ${carrier || 'not specified'}`);
      
      if (!trackingNumber.trim()) {
        console.log('Clearing tracking number for order:', orderId);
        
        // Find existing tracking for this order
        const { data: existingTracking } = await supabase
          .from('order_tracking')
          .select('tracking_number')
          .eq('order_id', orderId)
          .single();
          
        if (existingTracking?.tracking_number) {
          // Use tracking service to delete the tracking
          const result = await deleteTracking(existingTracking.tracking_number);
          console.log('Delete tracking result:', result);
          
          if (result.success) {
            toast.success('Tracking number removed successfully');
          } else if (result.dbSuccess) {
            // Partial success, but tracking is removed from our system
            toast.warning('Tracking removed from database but removal from carrier system may have failed');
          } else {
            toast.error('Failed to remove tracking number: ' + result.message);
          }
        } else {
          console.log('No existing tracking found to delete');
          toast.info('No tracking number found to delete');
        }
      } else {
        console.log('Setting tracking number:', trackingNumber, 'with carrier:', carrier);
        
        try {
          // Use the tracking service to add tracking with the specified carrier
          // Pass carrier as is - empty string will trigger auto-detection
          await addTracking(orderId, trackingNumber, carrier);
          toast.success('Tracking number added successfully');
        } catch (addError: any) {
          // Special handling for timeout errors which might actually succeed in the background
          if (addError.message && addError.message.includes('timeout')) {
            console.warn('Database timeout when adding tracking:', addError);
            toast.warning('The operation is taking longer than expected. Your tracking number may still be added in the background. Please check back in a few minutes.');
            // We'll still try to refresh orders after a delay
            setTimeout(async () => {
              try {
                await refreshOrders();
              } catch (refreshError) {
                console.error('Error refreshing orders after timeout:', refreshError);
              }
            }, 5000);
            return; // Early return to prevent the immediate refresh
          } else {
            throw addError; // Re-throw for normal error handling
          }
        }
      }

      // Wait for the refresh to complete before returning
      console.log('Refreshing orders after tracking update');
      await refreshOrders();
      console.log('Orders refreshed successfully');
    } catch (error: any) {
      console.error('Error updating tracking number:', error);
      
      // Format error message for user
      const errorMessage = 
        error?.message || 
        (error?.code ? `Database error (${error.code})` : 'Unknown error');
      
      toast.error(`Error: ${errorMessage}`);
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
        // Create a full name from firstName and lastName if they exist
        const fullName = order.contactInfo?.firstName && order.contactInfo?.lastName 
          ? `${order.contactInfo.firstName} ${order.contactInfo.lastName}`.toLowerCase()
          : '';
          
        return (
          // Order identification
          (order.order_number?.toLowerCase().includes(query) || false) ||
          
          // Product information
          (order.product_name?.toLowerCase().includes(query) || false) ||
          (order.product_sku?.toLowerCase().includes(query) || false) ||
          (order.collection_name?.toLowerCase().includes(query) || false) ||
          
          // Shipping info
          (order.shippingAddress?.address?.toLowerCase().includes(query) || false) ||
          (order.shippingAddress?.city?.toLowerCase().includes(query) || false) ||
          (order.shippingAddress?.country?.toLowerCase().includes(query) || false) ||
          
          // Contact info - check all parts of contact information
          (order.contactInfo?.value?.toLowerCase().includes(query) || false) ||
          (order.contactInfo?.firstName?.toLowerCase().includes(query) || false) ||
          (order.contactInfo?.lastName?.toLowerCase().includes(query) || false) ||
          (order.contactInfo?.phoneNumber?.toLowerCase().includes(query) || false) ||
          fullName.includes(query) ||
          
          // Transaction details
          (order.transactionSignature?.toLowerCase().includes(query) || false) ||
          (order.walletAddress?.toLowerCase().includes(query) || false) ||
          
          // Tracking and coupon
          (order.tracking?.tracking_number?.toLowerCase().includes(query) || false) ||
          (order.payment_metadata?.couponCode?.toLowerCase().includes(query) || false)
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
          refreshOrders={refreshOrders}
        />
      )}
    </div>
  );
}