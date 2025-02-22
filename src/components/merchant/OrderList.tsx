import React from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, ExternalLink, Package, Truck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Order, OrderStatus } from '../../types/orders';
import { OrderItem } from './OrderItem';

interface OrderListProps {
  orders: Order[];
  onStatusUpdate?: (orderId: string, status: OrderStatus) => Promise<void>;
}

export function OrderList({ orders, onStatusUpdate }: OrderListProps) {
  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'confirmed':
        return <Package className="h-4 w-4 text-blue-400" />;
      case 'shipped':
        return <Truck className="h-4 w-4 text-purple-400" />;
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'confirmed':
        return 'bg-blue-500/10 text-blue-400';
      case 'shipped':
        return 'bg-purple-500/10 text-purple-400';
      case 'delivered':
        return 'bg-green-500/10 text-green-400';
      case 'cancelled':
        return 'bg-red-500/10 text-red-400';
    }
  };

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <OrderItem
          key={order.id}
          order={order}
          onStatusUpdate={onStatusUpdate}
        />
      ))}
    </div>
  );
}