import React from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useOrders } from '../hooks/useOrders';
import { Package, ExternalLink, Clock, Ban, CheckCircle2, Truck, Send, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { OrderStatus } from '../types/orders';

export function OrdersPage() {
  const { walletAddress } = useWallet();
  const { orders, loading } = useOrders();

  const getStatusIcon = (status: OrderStatus) => {
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
        return <Ban className="h-4 w-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: OrderStatus) => {
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

  const SupportMessage = () => (
    <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 bg-purple-500/10 rounded-lg">
      <p className="text-sm text-purple-300">Need help with your order?</p>
      <div className="flex items-center gap-3">
        <a
          href="https://t.me/storedotfun"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Telegram</span>
        </a>
        <a
          href="mailto:store@dotfunenterprises.fun"
          className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300"
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Email</span>
        </a>
      </div>
    </div>
  );

  if (!walletAddress) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
        <Package className="h-12 w-12 text-gray-600 mb-4" />
        <h1 className="text-xl font-bold mb-2">Connect Your Wallet</h1>
        <p className="text-gray-400">Connect your wallet to view your orders</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-900 rounded-lg p-4">
            <div className="h-20 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Your Orders</h1>
        <SupportMessage />
      </div>
      
      {orders.length === 0 ? (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
          <Package className="h-12 w-12 text-gray-600 mb-4" />
          <h1 className="text-xl font-bold mb-2">No Orders Yet</h1>
          <p className="text-gray-400">You haven't placed any orders yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-gray-900 rounded-lg p-4 space-y-4">
              {/* Order Header */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-4 border-b border-gray-800">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-300">Order ID: {order.id.slice(0, 8)}</span>
                  <span className="text-[10px] text-gray-500">•</span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:ml-auto">
                  {getStatusIcon(order.status)}
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm">{order.product.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">
                      {order.product.collection.name}
                    </span>
                  </div>

                  <div className="mt-2">
                    <span className="text-sm font-medium">
                      {order.amountSol} SOL
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                {/* Shipping Info */}
                {order.shippingAddress && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-300 mb-1">Shipping Details</h4>
                    <pre className="text-xs text-gray-400 font-mono bg-gray-950 p-2 rounded whitespace-pre-wrap">
                      {JSON.stringify(order.shippingAddress, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Contact Info */}
                {order.contactInfo && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-300 mb-1">Contact Info</h4>
                    <pre className="text-xs text-gray-400 font-mono bg-gray-950 p-2 rounded whitespace-pre-wrap">
                      {JSON.stringify(order.contactInfo, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Transaction Info */}
                <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">Transaction:</span>
                    <a
                      href={`https://solscan.io/tx/${order.transactionSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      {order.transactionSignature.slice(0, 8)}...{order.transactionSignature.slice(-8)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}