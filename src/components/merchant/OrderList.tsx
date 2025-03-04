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
  isAdmin?: boolean;
}

export function OrderList({ orders, onStatusUpdate, isAdmin }: OrderListProps) {
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
      toast.error(error instanceof Error ? error.message : 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const canUpdateOrderStatus = (order: Order) => {
    return isAdmin || order.accessType === 'edit';
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
            escapeCSV(order.product?.name || ''),
            escapeCSV(order.product?.sku || ''),
            escapeCSV(typeof order.amountSol === 'number' ? order.amountSol.toFixed(2) : ''),
            escapeCSV(order.product?.collection?.name || ''),
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
    // Try to get info from live product first, then fall back to snapshot
    const name = order.product?.name || order.product_snapshot?.name || 'Unnamed Product';
    const imageUrl = order.product?.imageUrl || order.product_snapshot?.images?.[0];
    const sku = order.product?.sku || order.product_snapshot?.sku;
    const collectionName = order.product?.collection?.name || order.collection_snapshot?.name;
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
        <table className="min-w-full divide-y divide-gray-800">
          <thead>
            <tr>
              <th className="px-3 py-4 text-sm text-gray-400">Order</th>
              <th className="px-3 py-4 text-sm text-gray-400">Date</th>
              <th className="px-3 py-4 text-sm text-gray-400">Status</th>
              <th className="px-3 py-4 text-sm text-gray-400">Product</th>
              <th className="px-3 py-4 text-sm text-gray-400">SKU</th>
              <th className="px-3 py-4 text-sm text-gray-400">Amount (SOL)</th>
              <th className="px-3 py-4 text-sm text-gray-400">Collection</th>
              <th className="px-3 py-4 text-sm text-gray-400">Category</th>
              <th className="px-3 py-4 text-sm text-gray-400">Shipping Address</th>
              <th className="px-3 py-4 text-sm text-gray-400">Contact</th>
              <th className="px-3 py-4 text-sm text-gray-400">Wallet</th>
              <th className="px-3 py-4 text-sm text-gray-400">Transaction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredOrders.map(order => {
              const productInfo = getProductInfo(order);
              return (
                <tr key={order.id}>
                  <td className="px-3 py-4 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-white truncate">{order.order_number}</span>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(safeParseDate(order.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-300">
                    {canUpdateOrderStatus(order) ? (
                      <div className="relative">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusUpdate(order.id, e.target.value as OrderStatus)}
                          disabled={updatingOrderId === order.id}
                          className={`appearance-none w-full cursor-pointer rounded px-2 py-1 pr-8 text-xs font-medium transition-colors ${getStatusColor(order.status)}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
                          {updatingOrderId === order.id ? (
                            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                          ) : (
                            getStatusIcon(order.status)
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span className="capitalize">{order.status}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm sm:text-base text-white">{productInfo.name}</h3>
                      {productInfo.collectionName && (
                        <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full text-xs">
                          {productInfo.collectionName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      {productInfo.sku && (
                        <span className="text-gray-500 font-mono">#{productInfo.sku}</span>
                      )}
                      {typeof order.amountSol === 'number' && (
                        <span className="font-medium text-purple-400">{order.amountSol} SOL</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      {productInfo.collectionName && (
                        <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">
                          {productInfo.collectionName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      {productInfo.categoryName && (
                        <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                          {productInfo.categoryName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-300">
                    {order.shippingAddress && (
                      <div className="space-y-1.5">
                        {formatShippingAddress(order.shippingAddress)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-300">
                    {order.contactInfo && (
                      <div className="space-y-1.5">
                        {formatContactInfo(order.contactInfo)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-300">
                    {order.walletAddress && (
                      <div className="space-y-1.5">
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
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-300">
                    {order.transactionSignature && (
                      <div className="space-y-1.5">
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
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}