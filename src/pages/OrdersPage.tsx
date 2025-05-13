import { useWallet } from '../contexts/WalletContext';
import { useOrders } from '../hooks/useOrders';
import { Package, ExternalLink, Clock, Ban, CheckCircle2, Truck, Send, Mail, Twitter, Bug, PackageOpen, HelpCircle, ShoppingCart } from 'lucide-react';
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
import { SensitiveInfo } from '../components/ui/SensitiveInfo';
import { debugOrderSecurity } from '../utils/orderSecurity';
import { WalletAuthDebug } from '../components/debug/WalletAuthDebug';
import { OrderDebugPanel } from '../components/debug/OrderDebugPanel';
import { useUserRole } from '../contexts/UserRoleContext';
import { OrderShippingAddress } from '../components/OrderShippingAddress';

// Helper function to safely parse dates
const safeParseDate = (date: any): Date => {
  if (!date) return new Date(); // Default to current date if no date provided
  if (date instanceof Date) return date;
  try {
    if (typeof date === 'string') {
      const parsed = new Date(date);
      // Check if the parsed date is valid
      if (isNaN(parsed.getTime())) {
        console.warn('Invalid date string:', date);
        return new Date();
      }
      return parsed;
    }
  } catch (error) {
    console.warn('Error parsing date:', error);
  }
  return new Date();
};

export function OrdersPage() {
  const { walletAddress, walletAuthToken } = useWallet();
  const { orders, loading, error } = useOrders();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevWalletRef = useRef<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const { isAdmin } = useUserRole();
  
  // Debug logging
  useEffect(() => {
    console.log('OrdersPage state:', {
      walletAddress,
      loading,
      error,
      ordersCount: orders.length,
      isInitialLoad,
      ordersWithTracking: orders.filter(o => o.tracking).length,
      firstOrderTracking: orders.length > 0 ? orders[0].tracking : null,
      walletAuthStatus: walletAuthToken ? 'Authenticated' : 'Not Authenticated'
    });
  }, [walletAddress, loading, error, orders, isInitialLoad, walletAuthToken]);
  
  // Only run security verification in development mode when orders load
  useEffect(() => {
    if (!loading && orders.length > 0 && import.meta.env.DEV) {
      // Run security verification to ensure users only see their own orders
      debugOrderSecurity().catch(console.error);
    }
  }, [loading, orders.length]);
  
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
      case 'preparing':
        return <PackageOpen className="h-4 w-4 text-white-400" />;
      case 'shipped':
        return <Truck className="h-4 w-4 text-teal-400" />;
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'cancelled':
        return <Ban className="h-4 w-4 text-red-400" />;
      default:
        return <HelpCircle className="h-4 w-4 text-gray-400" />;
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
      case 'preparing':
        return 'bg-orange-500/10 text-orange-400';
      case 'shipped':
        return 'bg-teal-500/10 text-teal-400';
      case 'delivered':
        return 'bg-green-500/10 text-green-400';
      case 'cancelled':
        return 'bg-red-500/10 text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const formatShippingAddress = (shippingAddress: any) => {
    if (!shippingAddress) return null;
    
    // Only render if we have some minimal address data
    if (!shippingAddress.address && !shippingAddress.city && !shippingAddress.country) {
      return <div className="text-gray-500 text-xs">Address information unavailable</div>;
    }
    
    return <OrderShippingAddress address={shippingAddress} />;
  };

  const formatContactInfo = (contactInfo: any) => {
    if (!contactInfo) return null;
    
    // Extract fields with fallbacks
    const method = contactInfo.method || '';
    const value = contactInfo.value || '';
    
    // Only proceed if we have value data
    if (!value) {
      return <div className="text-gray-500 text-xs">Contact information unavailable</div>;
    }
    
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
            label: method ? (method.charAt(0).toUpperCase() + method.slice(1)) : 'Contact',
            value
          };
      }
    };

    const { icon, label, value: contactValue } = getContactInfo();
    
    const contactContent = (
      <div className="flex items-center gap-2 text-gray-300">
        {icon}
        <div className="flex flex-col">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-sm">{contactValue}</span>
        </div>
      </div>
    );
    
    return (
      <SensitiveInfo type="blur">
        {contactContent}
      </SensitiveInfo>
    );
  };

  const getProductImage = (order: Order): string | null => {
    // Try multiple possible image sources in order of priority
    if (order.product_snapshot?.images?.length > 0) {
      return order.product_snapshot.images[0];
    }
    
    // Try product_image_url directly if available
    if (order.product_image_url) {
      return order.product_image_url;
    }
    
    // Check for any image in the order object itself (accessing potentially undefined properties safely)
    const anyOrder = order as any; // Cast to any to avoid TypeScript errors
    if (anyOrder.products?.image_url) {
      return anyOrder.products.image_url;
    }
    
    // Check collection snapshot
    if (anyOrder.collection_snapshot?.image_url) {
      return anyOrder.collection_snapshot.image_url;
    }
    
    return null;
  };

  // Group orders by batch_order_id for display
  const groupOrdersByBatch = (orders: Order[]) => {
    // Create a map of batch_order_id to arrays of orders
    const batchMap = new Map<string, Order[]>();
    
    // Add orders to their respective batches
    orders.forEach(order => {
      if (order.batch_order_id) {
        // If this order is part of a batch
        const batchId = order.batch_order_id;
        if (!batchMap.has(batchId)) {
          batchMap.set(batchId, []);
        }
        batchMap.get(batchId)!.push(order);
      } else {
        // If this is a standalone order, use its ID as the key
        batchMap.set(order.id, [order]);
      }
    });
    
    // Convert map to array of batches
    return Array.from(batchMap.values()).sort((a, b) => {
      // Sort batches by creation date, newest first
      return new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime();
    });
  };

  // Group the orders for display
  const orderGroups = groupOrdersByBatch(orders);

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

  if (!walletAuthToken) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Your Orders</h1>
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
          <Package className="h-12 w-12 text-gray-600 mb-4" />
          <h1 className="text-xl font-bold mb-2">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-4">Please verify your wallet to view your order history</p>
          <button 
            onClick={() => {
              window.location.reload();
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-sm"
          >
            Verify Now
          </button>
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
          <Package className="h-12 w-12 text-gray-600 mb-4" />
          <h1 className="text-xl font-bold mb-2">Connection Needed</h1>
          <p className="text-gray-400 mb-4">We need to verify your wallet connection</p>
          <button 
            onClick={() => {
              window.location.reload();
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-sm"
          >
            Reconnect
          </button>
          
          {/* Add debugging option - only visible to admins */}
          {isAdmin && (
            <div className="mt-6 pt-4 border-t border-gray-200/10 max-w-md mx-auto w-full">
              <button
                onClick={() => setDebugMode(!debugMode)}
                className="text-xs flex items-center gap-1 text-gray-400 hover:text-gray-300 mx-auto"
              >
                <Bug className="h-3 w-3" />
                {debugMode ? 'Hide Debug Tools' : 'Debug Tools'}
              </button>
              
              {debugMode && (
                <div className="mt-2 space-y-2">
                  <WalletAuthDebug />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Your Orders</h1>
        <div className="flex items-center gap-2">
          <SupportMessage />
          {/* Only show debug button to admins */}
          {isAdmin && (
            <button
              onClick={() => setDebugMode(!debugMode)}
              className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-400"
            >
              <Bug className="h-3 w-3" />
              {debugMode ? 'Hide Debug' : 'Debug'}
            </button>
          )}
        </div>
      </div>
      
      {/* Debug panel - only visible to admins */}
      {isAdmin && debugMode && (
        <>
          <OrderDebugPanel />
          <WalletAuthDebug />
        </>
      )}
      
      {orders.length === 0 ? (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
          <Package className="h-12 w-12 text-gray-600 mb-4" />
          <h1 className="text-xl font-bold mb-2">No Orders Yet</h1>
          <p className="text-gray-400">You haven't placed any orders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orderGroups.map((group) => (
            <div key={group[0].batch_order_id || group[0].id} className="bg-gray-900 rounded-lg overflow-hidden group hover:ring-1 hover:ring-secondary/20 transition-all">
              {/* Order Number Header */}
              <div className="bg-gray-800/50 px-3 sm:px-4 py-2 sm:py-3">
                <div className="flex flex-col gap-0.5 sm:gap-2">
                  {/* Mobile Layout */}
                  <div className="flex items-center justify-between sm:hidden">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 shrink-0">Batch</span>
                      <span className="font-mono text-sm font-medium text-white truncate">{group[0].batch_order_id || group[0].id}</span>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wide ${getStatusColor(group[0].status)}`}>
                      {getStatusIcon(group[0].status)}
                      <span>{group[0].status.charAt(0).toUpperCase() + group[0].status.slice(1).replace('_', ' ')}</span>
                    </div>
                  </div>
                  {/* Mobile Date */}
                  <div className="sm:hidden">
                    <span className="text-[10px] text-gray-400">{formatDistanceToNow(safeParseDate(group[0].createdAt), { addSuffix: true })}</span>
                  </div>

                  {/* Desktop Layout - All inline */}
                  <div className="hidden sm:flex sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs uppercase tracking-wider text-gray-400 shrink-0">Batch</span>
                        <span className="font-mono font-medium text-white truncate">{group[0].batch_order_id || group[0].id}</span>
                      </div>
                      <span className="text-gray-600">•</span>
                      <span className="text-xs text-gray-400">{formatDistanceToNow(safeParseDate(group[0].createdAt), { addSuffix: true })}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wide ${getStatusColor(group[0].status)}`}>
                      {getStatusIcon(group[0].status)}
                      <span>{group[0].status.charAt(0).toUpperCase() + group[0].status.slice(1).replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Product Image */}
                  <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
                    {(() => {
                      const imageUrl = getProductImage(group[0]);
                      return imageUrl ? (
                        <OptimizedImage
                          src={imageUrl}
                          alt={group[0].product_name || 'Product'}
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
                          <h3 className="font-medium text-sm truncate">{group[0].product_name}</h3>
                          {group[0].collection_name && (
                            <span className="text-xs bg-secondary/40 text-secondary px-2 py-0.5 rounded-full shadow-sm shadow-secondary/10 backdrop-blur-sm font-medium shrink-0">
                              {group[0].collection_name}
                            </span>
                          )}
                        </div>
                        {group[0].product_sku && (
                          <p className="text-xs text-gray-400">SKU: {group[0].product_sku}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {group[0].variant_selections && group[0].variant_selections.length > 0 && (
                            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                              {group[0].variant_selections.map((v) => `${v.name}: ${v.value}`).join(', ')}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs mt-2">
                          Amount: {typeof group[0].amountSol === 'number' ? group[0].amountSol.toFixed(2) : '0.00'} SOL
                        </p>
                        
                        {/* Show batch indicator if this is a batch order */}
                        {group.length > 1 && (
                          <div className="mt-2 bg-indigo-500/15 text-indigo-400 px-2 py-1 rounded text-xs inline-flex items-center gap-1.5">
                            <ShoppingCart className="h-3 w-3" />
                            <span>Batch Order ({group.length} items)</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Order Details */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                      {/* Shipping Info */}
                      {group[0].shippingAddress && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-400 mb-2">Shipping Address</h4>
                          {formatShippingAddress(group[0].shippingAddress)}
                        </div>
                      )}
                      
                      {/* Contact Info */}
                      {group[0].contactInfo && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-400 mb-2">Contact</h4>
                          {formatContactInfo(group[0].contactInfo)}
                        </div>
                      )}
                    </div>

                    {/* Transaction Info */}
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {group[0].transactionSignature ? getTransactionLabel(group[0].transactionSignature) : "Transaction"}:
                          </span>
                          {group[0].transactionSignature ? (
                            <a
                              href={getTransactionUrl(group[0].transactionSignature)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs ${isStripeReceiptUrl(group[0].transactionSignature) || group[0].transactionSignature?.startsWith('pi_') ? '' : 'font-mono'} text-purple-400 hover:text-purple-300 flex items-center gap-1`}
                            >
                              {formatTransactionSignature(group[0].transactionSignature)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-gray-500">Not available</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tracking Info */}
                    {group[0].tracking && (
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-secondary" />
                          <span className="text-xs text-gray-400">Tracking Number:</span>
                          {group[0].tracking.tracking_number ? (
                            <Link
                              to={`/tracking/${group[0].tracking.tracking_number}`}
                              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {group[0].tracking.tracking_number}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-500">
                              No tracking number available
                            </span>
                          )}
                        </div>
                        {group[0].tracking.status && (
                          <div className="mt-2 text-xs text-secondary">
                            {group[0].tracking.status}
                            {group[0].tracking.status_details && (
                              <span className="text-gray-400 ml-1">- {group[0].tracking.status_details}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Show batch order details if this is a batch */}
                    {group.length > 1 && (
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <h4 className="text-xs font-medium text-gray-400 mb-2">Order Items</h4>
                        <div className="space-y-2">
                          {group.map((item, index) => (
                            <div key={item.id} className="bg-gray-800/30 rounded p-2 flex items-center gap-2">
                              <div className="bg-gray-700/50 h-6 w-6 rounded-full flex items-center justify-center text-xs text-gray-300 font-medium">
                                {item.item_index || index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white truncate">{item.product_name}</p>
                                {item.variant_selections && item.variant_selections.length > 0 && (
                                  <p className="text-xs text-gray-400 truncate">
                                    {item.variant_selections.map(v => `${v.name}: ${v.value}`).join(', ')}
                                  </p>
                                )}
                              </div>
                              <div className="text-xs text-gray-300 font-medium">
                                {typeof item.amountSol === 'number' ? item.amountSol.toFixed(2) : '0.00'} SOL
                              </div>
                            </div>
                          ))}
                        </div>
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