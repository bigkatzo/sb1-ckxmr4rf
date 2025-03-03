import { 
  ExternalLink, 
  Package, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Mail, 
  Send, 
  Twitter, 
  ChevronDown, 
  Loader2 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Order, OrderStatus } from '../../types/orders';
import { useState } from 'react';

interface OrderListProps {
  orders: Order[];
  onStatusUpdate?: (orderId: string, status: OrderStatus) => Promise<void>;
  canUpdateOrder?: (order: Order) => Promise<boolean>;
}

export function OrderList({ orders, onStatusUpdate, canUpdateOrder }: OrderListProps) {
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  
  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    if (!onStatusUpdate) return;
    
    try {
      setUpdatingOrderId(orderId);
      await onStatusUpdate(orderId, status);
    } finally {
      setUpdatingOrderId(null);
    }
  };

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
      <div className="space-y-0.5 text-gray-300 text-sm">
        <div>{address}</div>
        <div>{city} {zip}</div>
        <div>{country}</div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div 
          key={order.id} 
          className="bg-gray-900 rounded-lg overflow-hidden group hover:ring-1 hover:ring-purple-500/20 transition-all"
        >
          {/* Order Header - Status Bar */}
          <div className="bg-gray-800/50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs uppercase tracking-wider text-gray-400 shrink-0">Order</span>
                <span className="font-mono font-medium text-white truncate">{order.order_number}</span>
              </div>
              <span className="text-gray-600 shrink-0">•</span>
              <span className="text-xs text-gray-400 truncate shrink-0">{formatDistanceToNow(order.createdAt, { addSuffix: true })}</span>
            </div>
            {/* Status */}
            <div className="shrink-0">
              {onStatusUpdate && canUpdateOrder ? (
                <div className="relative">
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusUpdate(order.id, e.target.value as OrderStatus)}
                    className={`appearance-none cursor-pointer flex items-center gap-1.5 pl-9 pr-8 py-1.5 rounded-md text-xs font-medium uppercase tracking-wide transition-colors focus:ring-2 focus:ring-purple-500/40 focus:outline-none ${getStatusColor(order.status)} ${updatingOrderId === order.id ? 'opacity-50 cursor-wait' : ''}`}
                    disabled={updatingOrderId === order.id}
                  >
                    <option value="pending" className="bg-gray-900 pl-6">Pending</option>
                    <option value="confirmed" className="bg-gray-900 pl-6">Confirmed</option>
                    <option value="shipped" className="bg-gray-900 pl-6">Shipped</option>
                    <option value="delivered" className="bg-gray-900 pl-6">Delivered</option>
                    <option value="cancelled" className="bg-gray-900 pl-6">Cancelled</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    {updatingOrderId === order.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    )}
                  </div>
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    {getStatusIcon(order.status)}
                  </div>
                </div>
              ) : (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wide ${getStatusColor(order.status)}`}>
                  {getStatusIcon(order.status)}
                  <span>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-800">
            {/* Product Section */}
            <div className="p-4">
              <div className="flex gap-4">
                {/* Product Image */}
                <div className="w-16 sm:w-24 h-16 sm:h-24 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                  {order.product.imageUrl ? (
                    <img 
                      src={order.product.imageUrl} 
                      alt={order.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Product Info */}
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <h3 className="font-medium text-sm sm:text-base text-white">{order.product.name}</h3>
                      <div className="flex items-center gap-3 text-xs">
                        {order.product.sku && (
                          <span className="text-gray-500 font-mono">#{order.product.sku}</span>
                        )}
                        <span className="font-medium text-purple-400">{order.amountSol} SOL</span>
                      </div>
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
                      {order.product.variants && order.product.variants.length > 0 && (
                        <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                          {order.product.variants.map((v: { name: string; value: string }) => `${v.name}: ${v.value}`).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Order Details */}
            {(order.shippingAddress || order.contactInfo || order.walletAddress) && (
              <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Shipping Info */}
                {order.shippingAddress && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-medium uppercase tracking-wide text-gray-400">Shipping Address</h4>
                    {formatShippingAddress(order.shippingAddress)}
                  </div>
                )}
                
                {/* Contact Info */}
                {order.contactInfo && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-medium uppercase tracking-wide text-gray-400">Contact</h4>
                    {formatContactInfo(order.contactInfo)}
                  </div>
                )}
                
                {/* Transaction Links */}
                {order.walletAddress && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-medium uppercase tracking-wide text-gray-400">Transaction</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Wallet:</span>
                        <a 
                          href={`https://solscan.io/account/${order.walletAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
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
                          className="font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                        >
                          {order.transactionSignature.slice(0, 4)}...{order.transactionSignature.slice(-4)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}