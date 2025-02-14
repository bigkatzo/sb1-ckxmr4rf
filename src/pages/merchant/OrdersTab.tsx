import React, { useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { OrderList } from '../../components/merchant/OrderList';
import { OrderFilters } from '../../components/merchant/OrderFilters';
import { useMerchantOrders } from '../../hooks/useMerchantOrders';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { toast } from 'react-toastify';
import type { Order } from '../../types/orders';

export function OrdersTab() {
  const { orders, loading, error, refreshOrders, updateOrderStatus } = useMerchantOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');

  // Extract unique collections and products from orders
  const { collections, products } = React.useMemo(() => {
    const collectionsMap = new Map();
    const productsMap = new Map();

    orders.forEach(order => {
      if (order.product.collection?.name) {
        collectionsMap.set(order.product.collection.name, {
          id: order.product.collection.name,
          name: order.product.collection.name
        });
      }
      
      // Only add products if no collection is selected or if they belong to the selected collection
      if (!selectedCollection || order.product.collection?.name === selectedCollection) {
        productsMap.set(order.product.sku, {
          id: order.product.sku,
          name: `${order.product.name} (${order.product.sku})`
        });
      }
    });

    return {
      collections: Array.from(collectionsMap.values()),
      products: Array.from(productsMap.values())
    };
  }, [orders, selectedCollection]);

  // Reset product selection when collection changes
  const handleCollectionChange = (collectionId: string) => {
    setSelectedCollection(collectionId);
    setSelectedProduct(''); // Reset product selection
  };

  // Filter orders based on search and filters
  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      // Apply collection filter
      if (selectedCollection && order.product.collection?.name !== selectedCollection) {
        return false;
      }

      // Apply product filter
      if (selectedProduct && order.product.sku !== selectedProduct) {
        return false;
      }

      // Apply search query
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        return (
          order.orderNumber?.toLowerCase().includes(searchLower) ||
          order.product.name.toLowerCase().includes(searchLower) ||
          order.product.sku.toLowerCase().includes(searchLower) ||
          order.product.collection?.name.toLowerCase().includes(searchLower) ||
          order.product.category?.name.toLowerCase().includes(searchLower) ||
          order.walletAddress.toLowerCase().includes(searchLower) ||
          order.transactionId.toLowerCase().includes(searchLower) ||
          // Search in shipping info
          order.shippingInfo.address.toLowerCase().includes(searchLower) ||
          order.shippingInfo.contactValue.toLowerCase().includes(searchLower) ||
          // Search in variants
          order.variants?.some(variant => 
            variant.name.toLowerCase().includes(searchLower) ||
            variant.value.toLowerCase().includes(searchLower)
          )
        );
      }

      return true;
    });
  }, [orders, selectedCollection, selectedProduct, searchQuery]);

  const handleUpdateStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateOrderStatus(orderId, status);
      toast.success('Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshOrders();
      toast.success('Orders refreshed successfully');
    } catch (error) {
      console.error('Error refreshing orders:', error);
      toast.error('Failed to refresh orders');
    }
  };

  return (
    <div className="px-3 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold">Orders</h2>
            <RefreshButton onRefresh={handleRefresh} className="scale-90" />
          </div>
          <div className="text-[10px] sm:text-xs text-gray-400">
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
          </div>
        </div>

        <OrderFilters
          collections={collections}
          products={products}
          selectedCollection={selectedCollection}
          selectedProduct={selectedProduct}
          searchQuery={searchQuery}
          onCollectionChange={handleCollectionChange}
          onProductChange={setSelectedProduct}
          onSearchChange={setSearchQuery}
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 text-red-500 rounded-lg p-4">
            <p className="text-xs sm:text-sm">{error}</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 mb-3" />
              <p className="text-gray-400 text-xs sm:text-sm">
                {searchQuery || selectedCollection || selectedProduct
                  ? 'No orders match your filters.'
                  : 'No orders received yet.'}
              </p>
            </div>
          </div>
        ) : (
          <OrderList orders={filteredOrders} onUpdateStatus={handleUpdateStatus} />
        )}
      </div>
    </div>
  );
}