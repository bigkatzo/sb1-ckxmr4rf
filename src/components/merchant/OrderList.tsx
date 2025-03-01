import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Package, Truck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Order, OrderStatus } from '../../types/orders';

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
        <div key={order.id} className="bg-gray-900 rounded-lg p-3 group">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium text-sm truncate">{order.product.name}</h3>
                  <p className="text-gray-400 text-xs mt-1">
                    Collection: {order.product.collection.name}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Amount: {order.amountSol} SOL
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    <span>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                  </div>
                  {onStatusUpdate && (
                    <select
                      value={order.status}
                      onChange={(e) => onStatusUpdate(order.id, e.target.value as OrderStatus)}
                      className="bg-gray-800 rounded px-2 py-1 text-xs"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  )}
                </div>
              </div>
              
              <div className="mt-3 text-xs text-gray-400">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <div>
                    <span className="font-medium">Order ID:</span> {order.id}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Wallet:</span>
                    <a 
                      href={`https://solscan.io/account/${order.walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      {order.walletAddress.slice(0, 4)}...{order.walletAddress.slice(-4)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Transaction:</span>
                    <a 
                      href={`https://solscan.io/tx/${order.transactionSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      {order.transactionSignature.slice(0, 4)}...{order.transactionSignature.slice(-4)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div>
                    <span className="font-medium">Created:</span> {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                  </div>
                </div>
                
                {order.shippingAddress && (
                  <div className="mt-2">
                    <span className="font-medium">Shipping Info:</span>
                    <div className="mt-1">
                      <pre className="whitespace-pre-wrap text-xs font-mono bg-gray-950 p-2 rounded">
                        {JSON.stringify(order.shippingAddress, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                
                {order.contactInfo && (
                  <div className="mt-2">
                    <span className="font-medium">Contact Info:</span>
                    <div className="mt-1">
                      <pre className="whitespace-pre-wrap text-xs font-mono bg-gray-950 p-2 rounded">
                        {JSON.stringify(order.contactInfo, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}