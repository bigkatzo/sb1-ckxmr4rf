import { ExternalLink, Package, Truck, CheckCircle2, XCircle, Clock, Mail, Send, Twitter, ChevronDown } from 'lucide-react';
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
        return <Clock className="h-4 w-4" />;
      case 'confirmed':
        return <Package className="h-4 w-4" />;
      case 'shipped':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20';
      case 'confirmed':
        return 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20';
      case 'shipped':
        return 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20';
      case 'delivered':
        return 'text-green-400 bg-green-500/10 hover:bg-green-500/20';
      case 'cancelled':
        return 'text-red-400 bg-red-500/10 hover:bg-red-500/20';
    }
  };

  const formatContactInfo = (contactInfo: any) => {
    if (!contactInfo || !contactInfo.method || !contactInfo.value) return null;
    const { method, value } = contactInfo;
    
    const getContactInfo = () => {
      const cleanValue = typeof value === 'string' && value.startsWith('@') 
        ? value.slice(1) 
        : value;
      
      switch (method) {
        case 'x':
          return {
            url: `https://x.com/${cleanValue}`,
            display: `@${cleanValue}`,
            icon: <Twitter className="h-4 w-4 text-gray-400" />,
            label: 'X (Twitter)'
          };
        case 'telegram':
          return {
            url: `https://t.me/${cleanValue}`,
            display: `@${cleanValue}`,
            icon: <Send className="h-4 w-4 text-gray-400" />,
            label: 'Telegram'
          };
        case 'email':
          return {
            url: `mailto:${cleanValue}`,
            display: cleanValue,
            icon: <Mail className="h-4 w-4 text-gray-400" />,
            label: 'Email'
          };
        default:
          return {
            url: null,
            display: cleanValue,
            icon: <Send className="h-4 w-4 text-gray-400" />,
            label: method.charAt(0).toUpperCase() + method.slice(1)
          };
      }
    };

    const { url, display, icon, label } = getContactInfo();
    
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">{label}</span>
        <div className="flex items-center gap-2">
          {icon}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              {display}
            </a>
          ) : (
            <span className="text-gray-300">{display}</span>
          )}
        </div>
      </div>
    );
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

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="bg-gray-900 rounded-lg p-4 group">
          {/* Order Number Header */}
          <div className="mb-4 pb-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-400">Order #</span>
                <span className="text-lg font-mono font-medium text-white">{order.order_number}</span>
              </div>
              {/* Status */}
              <div className="w-auto">
                {onStatusUpdate ? (
                  <div className="relative">
                    <select
                      value={order.status}
                      onChange={(e) => onStatusUpdate(order.id, e.target.value as OrderStatus)}
                      className={`appearance-none cursor-pointer flex items-center gap-1.5 pl-9 pr-8 py-1.5 rounded text-sm transition-colors ${getStatusColor(order.status)}`}
                    >
                      <option value="pending" className="bg-gray-900 pl-6">Pending</option>
                      <option value="confirmed" className="bg-gray-900 pl-6">Confirmed</option>
                      <option value="shipped" className="bg-gray-900 pl-6">Shipped</option>
                      <option value="delivered" className="bg-gray-900 pl-6">Delivered</option>
                      <option value="cancelled" className="bg-gray-900 pl-6">Cancelled</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </div>
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      {getStatusIcon(order.status)}
                    </div>
                  </div>
                ) : (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    <span>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            {/* Product Image */}
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
              {order.product.imageUrl ? (
                <img 
                  src={order.product.imageUrl} 
                  alt={order.product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-6 w-6 text-gray-600" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Order Header */}
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">{order.product.name}</h3>
                    {order.product.sku && (
                      <span className="text-xs text-gray-500 font-mono">#{order.product.sku}</span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {order.product.collection && (
                      <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">
                        {order.product.collection.name}
                      </span>
                    )}
                    {order.product.category && (
                      <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                        {order.product.category.name}
                      </span>
                    )}
                    <span className="text-gray-400">
                      {order.amountSol} SOL
                    </span>
                  </div>

                  {/* Transaction Info */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Wallet:</span>
                      <a 
                        href={`https://solscan.io/account/${order.walletAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        {order.walletAddress.slice(0, 4)}...{order.walletAddress.slice(-4)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Tx:</span>
                      <a 
                        href={`https://solscan.io/tx/${order.transactionSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        {order.transactionSignature.slice(0, 4)}...{order.transactionSignature.slice(-4)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Created:</span>
                      <span>{formatDistanceToNow(order.createdAt, { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Order Details */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                {/* Shipping Info */}
                {order.shippingAddress && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-gray-400">Shipping Address</h4>
                    {formatShippingAddress(order.shippingAddress)}
                  </div>
                )}
                
                {/* Contact Info */}
                {order.contactInfo && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-gray-400">Contact</h4>
                    {formatContactInfo(order.contactInfo)}
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