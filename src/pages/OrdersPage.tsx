import { useWallet } from '../contexts/WalletContext';
import { useOrders } from '../hooks/useOrders';
import { Package, ExternalLink, Clock, Ban, CheckCircle2, Truck, Send, Mail, Twitter } from 'lucide-react';
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

  const formatShippingAddress = (shippingAddress: any) => {
    if (!shippingAddress) return null;
    const { address, city, country, zip } = shippingAddress;
    
    return (
      <div className="space-y-1 text-gray-300">
        <div>{address}</div>
        <div>{city}, {zip}</div>
        <div>{country}</div>
      </div>
    );
  };

  const formatContactInfo = (contactInfo: any) => {
    if (!contactInfo) return null;
    const { method, value } = contactInfo;
    
    const getContactInfo = () => {
      switch (method) {
        case 'x':
          return {
            icon: <Twitter className="h-3.5 w-3.5 text-gray-400" />,
            label: 'X (Twitter)',
            value
          };
        case 'telegram':
          return {
            icon: <Send className="h-3.5 w-3.5 text-gray-400" />,
            label: 'Telegram',
            value
          };
        case 'email':
          return {
            icon: <Mail className="h-3.5 w-3.5 text-gray-400" />,
            label: 'Email',
            value
          };
        default:
          return {
            icon: <Send className="h-3.5 w-3.5 text-gray-400" />,
            label: method.charAt(0).toUpperCase() + method.slice(1),
            value
          };
      }
    };

    const { icon, label, value: contactValue } = getContactInfo();
    
    return (
      <div className="flex items-center gap-2 text-gray-300">
        {icon}
        <div className="flex flex-col">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-sm">{contactValue}</span>
        </div>
      </div>
    );
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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Your Orders</h1>
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
          <Package className="h-12 w-12 text-gray-600 mb-4" />
          <h1 className="text-xl font-bold mb-2">Connect Your Wallet</h1>
          <p className="text-gray-400">Please connect your wallet to view your orders</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Your Orders</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-800 rounded-lg" />
          <div className="h-32 bg-gray-800 rounded-lg" />
        </div>
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
            <div key={order.id} className="bg-gray-900 rounded-lg p-4 group">
              <div className="flex items-start gap-4">
                {/* Product Image */}
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                  {order.product.imageUrl ? (
                    <img 
                      src={order.product.imageUrl} 
                      alt={order.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-gray-600" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Order Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm truncate">{order.product.name}</h3>
                      {order.product.sku && (
                        <p className="text-xs text-gray-400 mt-1">SKU: {order.product.sku}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {order.product.collection && (
                          <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">
                            {order.product.collection.name}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs mt-2">
                        Amount: {order.amountSol} SOL
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Order Details */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                    {/* Shipping Info */}
                    {order.shippingAddress && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-400 mb-2">Shipping Address</h4>
                        {formatShippingAddress(order.shippingAddress)}
                      </div>
                    )}
                    
                    {/* Contact Info */}
                    {order.contactInfo && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-400 mb-2">Contact</h4>
                        {formatContactInfo(order.contactInfo)}
                      </div>
                    )}
                  </div>

                  {/* Transaction Info */}
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Order ID:</span>
                        <span className="text-xs font-mono">{order.id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Transaction:</span>
                        <a
                          href={`https://solscan.io/tx/${order.transactionSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        >
                          {order.transactionSignature.slice(0, 8)}...{order.transactionSignature.slice(-8)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Created:</span>
                        <span className="text-xs text-gray-300">
                          {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
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