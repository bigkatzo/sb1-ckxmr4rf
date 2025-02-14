import React from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, ExternalLink, Package, Truck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Order } from '../../types/orders';

interface OrderListProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
}

export function OrderList({ orders, onUpdateStatus }: OrderListProps) {
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
    <div className="space-y-2 sm:space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="bg-gray-900 rounded-lg p-2.5 sm:p-3 space-y-3">
          {/* Order Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-2.5 border-b border-gray-800">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs sm:text-sm font-medium text-gray-300">#{order.orderNumber}</span>
              <span className="text-[10px] text-gray-500">•</span>
              <span className="text-[10px] sm:text-xs text-gray-400">
                {formatDistanceToNow(order.createdAt, { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              {getStatusIcon(order.status)}
              <select
                value={order.status}
                onChange={(e) => onUpdateStatus(order.id, e.target.value as Order['status'])}
                className={`text-[10px] sm:text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Product Info */}
          <div className="flex gap-2 sm:gap-3">
            {order.product.imageUrl ? (
              <img
                src={order.product.imageUrl}
                alt={order.product.name}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                <h3 className="font-medium text-xs sm:text-sm">{order.product.name}</h3>
                <p className="text-[10px] sm:text-xs text-gray-400">SKU: {order.product.sku}</p>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {order.product.collection && (
                  <span className="text-[10px] sm:text-xs bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-full">
                    {order.product.collection.name}
                  </span>
                )}
                {order.product.category && (
                  <span className="text-[10px] sm:text-xs bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full">
                    {order.product.category.name}
                  </span>
                )}
              </div>

              <div className="mt-1.5">
                <span className="text-[10px] sm:text-xs font-medium text-white">
                  {order.product.price} SOL
                </span>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-gray-800">
            {/* Variant Info */}
            {order.variants && order.variants.length > 0 && (
              <div>
                <h4 className="text-[10px] sm:text-xs font-medium text-gray-300 mb-1">Variants</h4>
                <div className="space-y-0.5">
                  {order.variants.map((variant, index) => (
                    <p key={index} className="text-[10px] sm:text-xs text-gray-400">
                      {variant.name}: <span className="text-gray-300">{variant.value}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Shipping Info */}
            <div>
              <h4 className="text-[10px] sm:text-xs font-medium text-gray-300 mb-1">Shipping Details</h4>
              <p className="text-[10px] sm:text-xs text-gray-400 whitespace-pre-line">
                {order.shippingInfo.address}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-1">
                Contact ({order.shippingInfo.contactMethod}): {order.shippingInfo.contactValue}
              </p>
            </div>

            {/* Transaction Info */}
            <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] sm:text-xs text-gray-400">Transaction:</span>
                <a
                  href={`https://solscan.io/tx/${order.transactionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] sm:text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  {order.transactionId.slice(0, 8)}...{order.transactionId.slice(-8)}
                  <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                </a>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] sm:text-xs text-gray-400">Wallet:</span>
                <a
                  href={`https://solscan.io/account/${order.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] sm:text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  {order.walletAddress.slice(0, 8)}...{order.walletAddress.slice(-8)}
                  <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}