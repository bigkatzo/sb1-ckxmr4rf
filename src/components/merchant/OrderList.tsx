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
  Loader2,
  Calendar,
  Download,
  BarChart3
} from 'lucide-react';
import { formatDistanceToNow, subDays, isAfter, startOfDay, format, parseISO, isBefore, isEqual } from 'date-fns';
import type { Order, OrderStatus } from '../../types/orders';
import { useState } from 'react';
import { OrderAnalytics } from './OrderAnalytics';
import { toast } from 'react-toastify';

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

// Helper function to safely parse dates
const safeParseDate = (date: any): Date => {
  if (!date) return new Date(); // Default to current date if no date provided
  if (date instanceof Date) return date;
  try {
    if (typeof date === 'string') {
      const parsed = parseISO(date);
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

interface OrderListProps {
  orders: Order[];
  onStatusUpdate?: (orderId: string, status: OrderStatus) => Promise<void>;
}

export function OrderList({ orders, onStatusUpdate }: OrderListProps) {
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  
  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    if (!onStatusUpdate) return;
    
    try {
      setUpdatingOrderId(orderId);
      await onStatusUpdate(orderId, status);
    } catch (error) {
      console.error('Failed to update order status:', error);
      toast.error('You do not have permission to update this order');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filterOrdersByDate = (orders: Order[], filter: DateFilter) => {
    const today = startOfDay(new Date());

    if (filter === 'today') {
      return orders.filter(order => {
        const date = safeParseDate(order.createdAt);
        return isAfter(date, today);
      });
    }
    if (filter === 'week') {
      return orders.filter(order => {
        const date = safeParseDate(order.createdAt);
        return isAfter(date, subDays(today, 7));
      });
    }
    if (filter === 'month') {
      return orders.filter(order => {
        const date = safeParseDate(order.createdAt);
        return isAfter(date, subDays(today, 30));
      });
    }
    if (filter === 'custom' && startDate && endDate) {
      const start = startOfDay(parseISO(startDate));
      const end = startOfDay(parseISO(endDate));
      return orders.filter(order => {
        const date = safeParseDate(order.createdAt);
        const orderDate = startOfDay(date);
        return (
          (isAfter(orderDate, start) || isEqual(orderDate, start)) &&
          (isBefore(orderDate, end) || isEqual(orderDate, end))
        );
      });
    }
    return orders;
  };

  const exportToCSV = async () => {
    try {
      setIsExporting(true);
      
      if (!filteredOrders.length) {
        throw new Error('No orders to export');
      }

      const headers = [
        'Order Number',
        'Date',
        'Status',
        'Product',
        'SKU',
        'Amount (SOL)',
        'Collection',
        'Category',
        'Shipping Address',
        'Contact',
        'Wallet',
        'Transaction'
      ];

      const escapeCSV = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes('"') || str.includes(',') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const formatShippingAddressCSV = (address: any): string => {
        if (!address) return '';
        try {
          const { address: addr, city, country, zip } = address;
          return [addr, city, zip, country].filter(Boolean).join(', ');
        } catch (err) {
          console.warn('Error formatting shipping address:', err);
          return '';
        }
      };

      const formatContactInfoCSV = (contact: any): string => {
        if (!contact || !contact.method || !contact.value) return '';
        try {
          return `${contact.method}: ${contact.value}`;
        } catch (err) {
          console.warn('Error formatting contact info:', err);
          return '';
        }
      };

      const rows = filteredOrders.map((order, index) => {
        try {
          return [
            escapeCSV(order.order_number),
            escapeCSV(format(safeParseDate(order.createdAt), 'yyyy-MM-dd HH:mm:ss')),
            escapeCSV(order.status),
            escapeCSV(order.product_name),
            escapeCSV(order.product_sku || ''),
            escapeCSV(typeof order.amountSol === 'number' ? order.amountSol.toFixed(2) : ''),
            escapeCSV(order.collection_name),
            escapeCSV(order.product?.category?.name || ''),
            escapeCSV(formatShippingAddressCSV(order.shippingAddress)),
            escapeCSV(formatContactInfoCSV(order.contactInfo)),
            escapeCSV(order.walletAddress || ''),
            escapeCSV(order.transactionSignature || '')
          ];
        } catch (err) {
          console.error(`Error processing order at index ${index}:`, err);
          // Return a row of empty values if there's an error
          return headers.map(() => '');
        }
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Add BOM for Excel UTF-8 compatibility
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `orders_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
      
      // Append, click, and cleanup
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export orders');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredOrders = filterOrdersByDate(orders, dateFilter);

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

  const getProductInfo = (order: Order) => {
    // Use direct fields first, then fall back to snapshots
    const name = order.product_name || order.product_snapshot?.name || 'Unnamed Product';
    const imageUrl = order.product?.imageUrl || order.product_snapshot?.images?.[0];
    const sku = order.product_sku || order.product_snapshot?.sku;
    const collectionName = order.collection_name || order.collection_snapshot?.name;
    const categoryName = order.product?.category?.name || order.product_snapshot?.category?.name;
    const variants = order.product?.variants || order.product_snapshot?.variants || [];
    const variantPrices = order.product?.variantPrices || order.product_snapshot?.variant_prices || {};

    return {
      name,
      imageUrl,
      sku,
      collectionName,
      categoryName,
      variants,
      variantPrices
    };
  };

  const renderStatusSelect = (order: Order) => {
    // Only show status update controls if user has edit access
    const canEdit = order.access_type === 'admin' || // Admin access
                   order.access_type === 'owner' || // Collection owner
                   order.access_type === 'edit'; // Edit access through collection_access
    
    if (!canEdit) {
      return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}>
          {getStatusIcon(order.status)}
          <span className="capitalize">{order.status}</span>
        </div>
      );
    }

    return (
      <select
        value={order.status}
        onChange={(e) => handleStatusUpdate(order.id, e.target.value as OrderStatus)}
        disabled={updatingOrderId === order.id}
        className={`appearance-none cursor-pointer rounded px-2 py-1 pr-8 text-xs font-medium transition-colors relative ${getStatusColor(order.status)}`}
        style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
      >
        <option value="pending">Pending</option>
        <option value="confirmed">Confirmed</option>
        <option value="shipped">Shipped</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
      </select>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with Filters and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        {/* Order Counter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
          </span>
          {dateFilter !== 'all' && (
            <span className="text-xs text-gray-500">
              ({orders.length} total)
            </span>
          )}
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Analytics Toggle */}
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded-md border border-gray-700 focus:ring-2 focus:ring-purple-500/40 focus:outline-none transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            <span>{showAnalytics ? 'Hide Analytics' : 'Show Analytics'}</span>
          </button>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Filter by date:</span>
            </div>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as DateFilter);
                if (e.target.value !== 'custom') {
                  setStartDate('');
                  setEndDate('');
                }
              }}
              className="bg-gray-800 text-gray-200 text-sm rounded-md border border-gray-700 px-3 py-1.5 focus:ring-2 focus:ring-purple-500/40 focus:outline-none cursor-pointer min-w-[120px]"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-800 text-gray-200 text-sm rounded-md border border-gray-700 px-3 py-1.5 focus:ring-2 focus:ring-purple-500/40 focus:outline-none"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-800 text-gray-200 text-sm rounded-md border border-gray-700 px-3 py-1.5 focus:ring-2 focus:ring-purple-500/40 focus:outline-none"
              />
            </div>
          )}

          {/* Export Button */}
          <button
            onClick={() => {
              console.log('Export button clicked');
              void exportToCSV();
            }}
            disabled={isExporting || filteredOrders.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded-md border border-gray-700 focus:ring-2 focus:ring-purple-500/40 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Analytics Section */}
      {showAnalytics && (
        <div className="mb-8">
          <OrderAnalytics
            orders={orders}
            timeRange={{
              start: startDate ? new Date(startDate) : subDays(new Date(), 30),
              end: endDate ? new Date(endDate) : new Date()
            }}
          />
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No orders found for the selected time period</p>
        </div>
      ) : (
        filteredOrders.map((order) => {
          const productInfo = getProductInfo(order);
          
          return (
            <div 
              key={order.id}
              className="bg-gray-900 rounded-lg overflow-hidden"
            >
              {/* Order Header - Status Bar */}
              <div className="bg-gray-800/50 px-3 sm:px-4 py-2 sm:py-3">
                <div className="flex flex-col gap-0.5 sm:gap-2">
                  {/* Mobile Layout */}
                  <div className="flex items-center justify-between sm:hidden">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 shrink-0">Order</span>
                      <span className="font-mono text-sm font-medium text-white truncate">{order.order_number}</span>
                    </div>
                    <div className="shrink-0">
                      <div className="flex items-center gap-2">
                        {updatingOrderId === order.id ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-blue-400 bg-blue-500/10">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Updating...</span>
                          </div>
                        ) : (
                          renderStatusSelect(order)
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Mobile Date */}
                  <div className="sm:hidden">
                    <span className="text-[10px] text-gray-400">
                      {formatDistanceToNow(safeParseDate(order.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Desktop Layout - All inline */}
                  <div className="hidden sm:flex sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs uppercase tracking-wider text-gray-400 shrink-0">Order</span>
                        <span className="font-mono font-medium text-white truncate">{order.order_number}</span>
                      </div>
                      <span className="text-gray-600">•</span>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(safeParseDate(order.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="shrink-0">
                      <div className="flex items-center gap-2">
                        {updatingOrderId === order.id ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-blue-400 bg-blue-500/10">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Updating...</span>
                          </div>
                        ) : (
                          renderStatusSelect(order)
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-800">
                {/* Product Section */}
                <div className="p-4">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="w-16 sm:w-24 h-16 sm:h-24 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                      {productInfo.imageUrl ? (
                        <img 
                          src={productInfo.imageUrl} 
                          alt={productInfo.name}
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
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm sm:text-base text-white">{productInfo.name}</h3>
                            {productInfo.collectionName && (
                              <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full text-xs">
                                {productInfo.collectionName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            {productInfo.sku && (
                              <span className="text-gray-500 font-mono">#{productInfo.sku}</span>
                            )}
                            {typeof order.amountSol === 'number' && (
                              <span className="font-medium text-purple-400">{order.amountSol} SOL</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {productInfo.categoryName && (
                            <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                              {productInfo.categoryName}
                            </span>
                          )}
                          {order.order_variants && order.order_variants.length > 0 && (
                            <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                              {order.order_variants.map((v: { name: string; value: string }) => `${v.name}: ${v.value}`).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Order Details */}
                {(order.shippingAddress || order.contactInfo || order.walletAddress) && (
                  <div className="px-4 py-3">
                    {/* Shipping & Contact Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {/* Shipping Info */}
                      {order.shippingAddress && (
                        <div className="space-y-1.5 col-span-1">
                          <h4 className="text-xs font-medium uppercase tracking-wide text-gray-400">Shipping Address</h4>
                          {formatShippingAddress(order.shippingAddress)}
                        </div>
                      )}
                      
                      {/* Contact Info */}
                      {order.contactInfo && (
                        <div className="space-y-1.5 col-span-1">
                          <h4 className="text-xs font-medium uppercase tracking-wide text-gray-400">Contact</h4>
                          {formatContactInfo(order.contactInfo)}
                        </div>
                      )}
                      
                      {/* Transaction Links */}
                      {order.walletAddress && (
                        <div className="space-y-1.5 col-span-2 sm:col-span-1">
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
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}