import { ExternalLink, Package, Truck, CheckCircle2, XCircle, Clock, Mail, Send } from 'lucide-react';
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

  const formatContactInfo = (contactInfo: any) => {
    if (!contactInfo || !contactInfo.contactMethod || !contactInfo.contactValue) return null;
    const { contactMethod, contactValue } = contactInfo;
    
    const getContactLink = () => {
      if (!contactValue) return {
        url: null,
        display: 'N/A',
        icon: <Send className="h-4 w-4 text-gray-400" />
      };

      const value = typeof contactValue === 'string' && contactValue.startsWith('@') 
        ? contactValue.slice(1) 
        : contactValue;
      
      switch (contactMethod) {
        case 'x':
          return {
            url: `https://x.com/${value}`,
            display: `@${value}`,
            icon: <Send className="h-4 w-4 text-gray-400" />
          };
        case 'telegram':
          return {
            url: `https://t.me/${value}`,
            display: `@${value}`,
            icon: <Send className="h-4 w-4 text-gray-400" />
          };
        case 'email':
          return {
            url: `mailto:${value}`,
            display: value,
            icon: <Mail className="h-4 w-4 text-gray-400" />
          };
        default:
          return {
            url: null,
            display: value,
            icon: <Send className="h-4 w-4 text-gray-400" />
          };
      }
    };

    const { url, display, icon } = getContactLink();
    
    return (
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
                  <div className="flex flex-wrap gap-2 mt-2">
                    {order.product.collection && (
                      <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">
                        {order.product.collection.name}
                      </span>
                    )}
                    {order.product.category && (
                      <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                        {order.product.category.name}
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
              <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-400 space-y-2">
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
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}