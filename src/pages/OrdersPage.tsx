import { useWallet } from '../contexts/WalletContext';
import { useOrders } from '../hooks/useOrders';
import { Package, ExternalLink, Clock, Ban, CheckCircle2, Truck, Send, Mail, Twitter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Order, OrderStatus } from '../types/orders';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import { ImageIcon } from 'lucide-react';
import { OrderPageSkeleton } from '../components/ui/Skeletons';
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  getTransactionUrl, 
  formatTransactionSignature, 
  getTransactionLabel,
  isStripeReceiptUrl
} from '../utils/transactions';
import { SupportMessage } from '../components/ui/SupportMessage';

export function OrdersPage() {
  const { walletAddress } = useWallet();
  const { orders, loading, error } = useOrders();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevWalletRef = useRef<string | null>(null);
  
  // Debug logging
  useEffect(() => {
    console.log('OrdersPage state:', {
      walletAddress,
      loading,
      error,
      ordersCount: orders.length,
      isInitialLoad
    });
  }, [walletAddress, loading, error, orders, isInitialLoad]);
  
  // Reset isInitialLoad when wallet address changes
  useEffect(() => {
    if (prevWalletRef.current !== walletAddress) {
      setIsInitialLoad(true);
      prevWalletRef.current = walletAddress;
    }
  }, [walletAddress]);
  
  // Track initial vs subsequent loads
  useEffect(() => {
    if (!loading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loading, isInitialLoad]);

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'draft':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'pending_payment':
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
      case 'draft':
        return 'bg-gray-500/10 text-gray-400';
      case 'pending_payment':
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
      <div className="space-y-0.5 text-gray-300 text-xs">
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

  const getProductImage = (order: Order): string | null => {
    return order.product_snapshot?.images?.[0] || null;
  };

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
    return <OrderPageSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Your Orders</h1>
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
          <div className="bg-red-500/10 text-red-400 p-4 rounded-lg max-w-md">
            <h2 className="text-lg font-semibold mb-2">Error Loading Orders</h2>
            <p>{error}</p>
          </div>
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
            <div key={order.id} className="bg-gray-900 rounded-lg overflow-hidden group hover:ring-1 hover:ring-purple-500/20 transition-all">
              {/* Order Number Header */}
              <div className="bg-gray-800/50 px-3 sm:px-4 py-2 sm:py-3">
                <div className="flex flex-col gap-0.5 sm:gap-2">
                  {/* Mobile Layout */}
                  <div className="flex items-center justify-between sm:hidden">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 shrink-0">Order</span>
                      <span className="font-mono text-sm font-medium text-white truncate">{order.order_number}</span>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wide ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                    </div>
                  </div>
                  {/* Mobile Date */}
                  <div className="sm:hidden">
                    <span className="text-[10px] text-gray-400">{formatDistanceToNow(order.createdAt, { addSuffix: true })}</span>
                  </div>

                  {/* Desktop Layout - All inline */}
                  <div className="hidden sm:flex sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs uppercase tracking-wider text-gray-400 shrink-0">Order</span>
                        <span className="font-mono font-medium text-white truncate">{order.order_number}</span>
                      </div>
                      <span className="text-gray-600">•</span>
                      <span className="text-xs text-gray-400">{formatDistanceToNow(order.createdAt, { addSuffix: true })}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wide ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      <span>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Product Image */}
                  <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
                    {(() => {
                      const imageUrl = getProductImage(order);
                      return imageUrl ? (
                        <OptimizedImage
                          src={imageUrl}
                          alt={order.product_name}
                          width={160}
                          height={160}
                          quality={75}
                          className="object-cover w-full h-full"
                          sizes="80px"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-gray-600" />
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Order Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm truncate">{order.product_name}</h3>
                          {order.collection_name && (
                            <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full shrink-0">
                              {order.collection_name}
                            </span>
                          )}
                        </div>
                        {order.product_sku && (
                          <p className="text-xs text-gray-400">SKU: {order.product_sku}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {order.variant_selections && order.variant_selections.length > 0 && (
                            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                              {order.variant_selections.map((v) => `${v.name}: ${v.value}`).join(', ')}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs mt-2">
                          Amount: {order.amountSol} SOL
                        </p>
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
                          <span className="text-xs text-gray-400">
                            {order.transactionSignature ? getTransactionLabel(order.transactionSignature) : "Transaction"}:
                          </span>
                          {order.transactionSignature ? (
                            <a
                              href={getTransactionUrl(order.transactionSignature)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs ${isStripeReceiptUrl(order.transactionSignature) ? '' : 'font-mono'} text-purple-400 hover:text-purple-300 flex items-center gap-1`}
                            >
                              {formatTransactionSignature(order.transactionSignature)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-gray-500">Not available</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tracking Info */}
                    {order.tracking && (
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-purple-400" />
                          <span className="text-xs text-gray-400">Tracking Number:</span>
                          <Link
                            to={`/tracking/${order.tracking.tracking_number}`}
                            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                          >
                            {order.tracking.tracking_number}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                        {order.tracking.status && (
                          <div className="mt-2 text-xs text-purple-400">
                            {order.tracking.status}
                            {order.tracking.status_details && (
                              <span className="text-gray-400 ml-1">- {order.tracking.status_details}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
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