import { useOptimisticUpdate } from './useOptimisticUpdate';
import type { Order, OrderStatus } from '../types/orders';

export function useOrderOptimisticUpdate(initialOrders: Order[] = []) {
  const {
    items: orders,
    addItem,
    updateItem,
    removeItem,
    revertUpdate,
    setItems
  } = useOptimisticUpdate<Order>(initialOrders);

  const updateStatus = (id: string, status: OrderStatus) => {
    updateItem(id, { status });
  };

  const updatePaymentStatus = (id: string, status: 'pending' | 'paid' | 'failed') => {
    updateItem(id, { payment_status: status });
  };

  const updateShippingStatus = (id: string, status: 'pending' | 'shipped' | 'delivered') => {
    updateItem(id, { shipping_status: status });
  };

  const updateTrackingNumber = (id: string, trackingNumber: string) => {
    updateItem(id, { tracking_number: trackingNumber });
  };

  const updateNotes = (id: string, notes: string) => {
    updateItem(id, { notes });
  };

  return {
    orders,
    setOrders: setItems,
    addOrder: addItem,
    updateOrder: updateItem,
    removeOrder: removeItem,
    revertOrders: revertUpdate,
    updateStatus,
    updatePaymentStatus,
    updateShippingStatus,
    updateTrackingNumber,
    updateNotes
  };
} 