import { useWallet } from '../contexts/WalletContext';
import { useOrders } from '../hooks/useOrders';
import { Package, ExternalLink, Clock, Ban, CheckCircle2, Truck, Send, Mail, Twitter } from 'lucide-react';
import type { Order, OrderStatus } from '../types/orders';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import { ImageIcon } from 'lucide-react';
import { OrderPageSkeleton } from '../components/ui/Skeletons';
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TrackingDetails } from '../components/TrackingDetails';

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

  const renderTrackingInfo = (order: Order) => {
    if (!order.tracking) return null;
    
    return (
      <div className="mt-2">
        <Link
          to={`/tracking/${order.tracking.tracking_number}`}
          className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          <Truck className="h-3 w-3" />
          Track Order
          <ExternalLink className="h-3 w-3" />
        </Link>
        {order.tracking.status && (
          <div className="mt-1 text-xs text-purple-400">
            {order.tracking.status}
            {order.tracking.status_details && (
              <span className="text-gray-400 ml-1">- {order.tracking.status_details}</span>
            )}
          </div>
        )}
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
          href="mailto:support@store.fun"
          className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300"
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Email</span>
        </a>
      </div>
    </div>
  );

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
            <div key={order.id} className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Order #</span>
                    <span className="font-mono text-sm">{order.order_number}</span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    <div className="flex items-center gap-1.5">
                      {getStatusIcon(order.status)}
                      <span>{order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-24 h-24 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                    {(() => {
                      const imageUrl = getProductImage(order);
                      return imageUrl ? (
                        <OptimizedImage
                          src={imageUrl}
                          alt={order.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-gray-500" />
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-medium">{order.product_name}</h3>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-400">{order.collection_name}</span>
                    </div>
                    
                    {order.product_sku && (
                      <p className="text-sm text-gray-400 mb-2">SKU: {order.product_sku}</p>
                    )}
                    
                    {order.variant_selections && order.variant_selections.length > 0 && (
                      <div className="mb-2">
                        <h4 className="text-sm text-gray-400 mb-1">Selected Options:</h4>
                        <div className="flex flex-wrap gap-2">
                          {order.variant_selections.map((variant, index) => (
                            <div
                              key={index}
                              className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                            >
                              {variant.name}: {variant.value}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-gray-300 mb-4">Amount: {order.amountSol} SOL</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {order.shippingAddress && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Shipping Address</h4>
                          {formatShippingAddress(order.shippingAddress)}
                        </div>
                      )}
                      
                      {order.contactInfo && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Contact Info</h4>
                          {formatContactInfo(order.contactInfo)}
                        </div>
                      )}
                    </div>

                    {renderTrackingInfo(order)}

                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Transaction:</span>
                        {order.transactionSignature ? (
                          <a
                            href={`https://solscan.io/tx/${order.transactionSignature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1"
                          >
                            {order.transactionSignature.slice(0, 8)}...{order.transactionSignature.slice(-8)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-500">Not available</span>
                        )}
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