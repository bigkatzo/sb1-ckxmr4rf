import React, { useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { OrderList } from '../../components/merchant/OrderList';
import { OrderFilters } from '../../components/merchant/OrderFilters';
import { useMerchantOrders } from '../../hooks/useMerchantOrders';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { toast } from 'react-toastify';
import type { Order, OrderStatus } from '../../types/orders';

export function OrdersTab() {
  const { orders, loading, error, refreshOrders, updateOrderStatus } = useMerchantOrders();
  const { collections } = useMerchantCollections();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');

  // Extract unique products from filtered orders
  const products = React.useMemo(() => {
    const productsMap = new Map();
    
    orders.forEach(order => {
      // Only add products if no collection is selected or if they belong to the selected collection
      if (!selectedCollection || order.product.collection?.id === selectedCollection) {
        productsMap.set(order.product.sku, {
          id: order.product.sku,
          name: `${order.product.name} (${order.product.sku})`
        });
      }
    });

    return Array.from(productsMap.values());
  }, [orders, selectedCollection]);

  // Reset product selection when collection changes
  const handleCollectionChange = (collectionId: string) => {
    setSelectedCollection(collectionId);
    setSelectedProduct(''); // Reset product selection
  };

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, status);
      toast.success('Order status updated successfully');
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  // Filter orders based on selected collection and product
  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      // Filter by collection if selected
      if (selectedCollection && order.product.collection?.id !== selectedCollection) {
        return false;
      }

      // Filter by product if selected
      if (selectedProduct && order.product.sku !== selectedProduct) {
        return false;
      }

      return true;
    });
  }, [orders, selectedCollection, selectedProduct]);

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="bg-red-500/10 text-red-500 rounded-lg p-4">
          <p className="text-sm">{error}</p>
        </div>
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
          selectedCollection={selectedCollection}
          selectedProduct={selectedProduct}
          searchQuery={searchQuery}
          onCollectionChange={handleCollectionChange}
          onProductChange={setSelectedProduct}
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
        />
      )}
    </div>
  );
}