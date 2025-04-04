import { Link } from 'react-router-dom';
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
  Calendar,
  Download,
  BarChart3,
  Link as LinkIcon,
  CreditCard,
  Tag
} from 'lucide-react';
import { formatDistanceToNow, subDays, isAfter, startOfDay, format, parseISO, isBefore, isEqual } from 'date-fns';
import type { Order, OrderStatus, OrderVariant } from '../../types/orders';
import { useState } from 'react';
import { OrderAnalytics } from './OrderAnalytics';
import { toast } from 'react-toastify';
import { OptimizedImage } from '../ui/OptimizedImage';
import { ImageIcon } from 'lucide-react';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { Button } from '../ui/Button';
import { addTracking } from '../../services/tracking';

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
  const [editingTrackingId, setEditingTrackingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);

  // Function to check if user has permission to edit order status
  const canEditOrderStatus = (order: Order): boolean => {
    if (!order.access_type) return false;
    return ['admin', 'owner', 'edit'].includes(order.access_type);
  };
  
  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    if (!onStatusUpdate) return;
    
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Check if user has permission to edit order status
    if (!canEditOrderStatus(order)) {
      toast.error('You do not have permission to update this order');
      return;
    }
    
    try {
      setUpdatingOrderId(orderId);
      await onStatusUpdate(orderId, status);
      toast.success('Order status updated successfully');
    } catch (error) {
      console.error('Failed to update order status:', error);
      toast.error('Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleTrackingUpdate = async (orderId: string, trackingNumber: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Check if user has permission to edit order
    if (!canEditOrderStatus(order)) {
      toast.error('You do not have permission to update this order');
      return;
    }
    
    try {
      await addTracking(orderId, trackingNumber);
      setEditingTrackingId(null);
      toast.success('Tracking number added successfully');
    } catch (error) {
      console.error('Failed to add tracking number:', error);
      toast.error('Failed to add tracking number');
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
          const parts = [
            `${contact.method}: ${contact.value}`,
            contact.fullName ? `Name: ${contact.fullName}` : null,
            contact.phoneNumber ? `Phone: ${contact.phoneNumber}` : null
          ].filter(Boolean);
          return parts.join(' | ');
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
            escapeCSV(order.category_name || ''),
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
      case 'draft':
        return <Clock className="h-4 w-4" />;
      case 'pending_payment':
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

  const getStatusColor = (status: Order['status'] | string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return 'text-gray-400 bg-gray-500/10 hover:bg-gray-500/20';
      case 'pending_payment':
        return 'text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 font-medium';
      case 'confirmed':
        return 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20';
      case 'shipped':
        return 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20';
      case 'delivered':
        return 'text-green-400 bg-green-500/10 hover:bg-green-500/20';
      case 'cancelled':
        return 'text-red-400 bg-red-500/10 hover:bg-red-500/20';
      case 'in_transit':
        return 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20';
      case 'out_for_delivery':
        return 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20';
      case 'pending':
        return 'text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20';
      default:
        return 'text-gray-400 bg-gray-500/10 hover:bg-gray-500/20';
    }
  };

  const renderPaymentMetadataTags = (order: Order) => {
    const tags = [];

    // Add payment method tag only for Stripe payments
    if (order.payment_metadata?.paymentMethod === 'stripe') {
      tags.push(
        <span 
          key="payment-method"
          className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full flex items-center gap-1"
        >
          <CreditCard className="h-3 w-3" />
          <span>Stripe</span>
        </span>
      );
    }

    // Add discount tag if applicable
    if (order.payment_metadata?.couponDiscount && order.payment_metadata?.originalPrice) {
      const discountPercent = Math.min(
        100,
        Math.round((order.payment_metadata.couponDiscount / order.payment_metadata.originalPrice) * 100)
      );
      tags.push(
        <span 
          key="discount"
          className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1"
          title={order.payment_metadata.couponCode ? `Coupon: ${order.payment_metadata.couponCode}` : undefined}
        >
          <Tag className="h-3 w-3" />
          <span>{discountPercent}% off</span>
        </span>
      );
    }

    if (tags.length === 0) return null;

    return (
      <div className="flex items-center gap-1.5">
        {tags}
      </div>
    );
  };

  const formatContactInfo = (contactInfo: any) => {
    if (!contactInfo || !contactInfo.method || !contactInfo.value) return null;
    const { method, value, fullName, phoneNumber } = contactInfo;
    
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
        <div className="flex flex-col gap-1">
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
          {fullName && (
            <div className="text-sm text-gray-300">
              <span className="text-gray-400">Name:</span> {fullName}
            </div>
          )}
          {phoneNumber && (
            <div className="text-sm text-gray-300">
              <span className="text-gray-400">Phone:</span> {phoneNumber}
            </div>
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
    return {
      name: order.product_name,
      sku: order.product_sku,
      imageUrl: order.product_image_url,
      collectionName: order.collection_name,
      categoryName: order.category_name,
      variants: order.order_variants,
      variantPrices: order.product_variant_prices
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

    // Only show allowed status options based on current status
    const allowedStatuses = ['confirmed', 'shipped', 'delivered', 'cancelled'];
    
    // If the order is already in draft or pending_payment, allow it to stay there
    // but don't allow changing to these statuses
    if (order.status === 'draft' || order.status === 'pending_payment') {
      allowedStatuses.unshift(order.status);
    }

    return (
      <select
        value={order.status}
        onChange={(e) => handleStatusUpdate(order.id, e.target.value as OrderStatus)}
        disabled={updatingOrderId === order.id}
        className={`appearance-none cursor-pointer rounded px-2 py-1 pr-8 text-xs font-medium transition-colors relative ${getStatusColor(order.status)}`}
        style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
      >
        {allowedStatuses.map(status => (
          <option key={status} value={status}>
            {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </option>
        ))}
      </select>
    );
  };

  const renderTrackingSection = (order: Order) => {
    const canEdit = canEditOrderStatus(order) && 
      !['cancelled', 'draft', 'pending_payment'].includes(order.status);
    const isEditing = editingTrackingId === order.id;

    return (
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-purple-400" />
            <span className="text-sm text-gray-400">Tracking Number</span>
          </div>
          {canEdit && (
            <button
              onClick={() => setEditingTrackingId(order.id)}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              {order.tracking?.tracking_number ? (
                <>
                  <LinkIcon className="h-3 w-3" />
                  Edit
                </>
              ) : (
                <>
                  <Package className="h-3 w-3" />
                  Add Tracking
                </>
              )}
            </button>
          )}
        </div>
        
        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const input = form.elements.namedItem('tracking') as HTMLInputElement;
              if (!input.value.trim()) {
                toast.error('Please enter a tracking number');
                return;
              }
              void handleTrackingUpdate(order.id, input.value.trim());
            }}
            className="mt-2 flex items-center gap-2"
          >
            <input
              type="text"
              name="tracking"
              defaultValue={order.tracking?.tracking_number || ''}
              placeholder="Enter tracking number"
              className="flex-1 bg-gray-800 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg flex items-center gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingTrackingId(null)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg flex items-center gap-1"
              >
                <XCircle className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-2">
            {order.tracking?.tracking_number ? (
              <div className="space-y-2">
                <Link 
                  to={`/tracking/${order.tracking.tracking_number}`} 
                  className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <Truck className="h-3 w-3" />
                  {order.tracking.tracking_number}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {order.tracking.status && (
                  <div className={`text-xs ${getStatusColor(order.tracking.status)}`}>
                    {order.tracking.status_details || order.tracking.status}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Package className="h-3 w-3" />
                No tracking number
              </span>
            )}
          </div>
        )}
      </div>
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
          <Button
            onClick={() => void exportToCSV()}
            disabled={isExporting || filteredOrders.length === 0}
            variant="secondary"
            size="sm"
            isLoading={isExporting}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export to CSV
          </Button>
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
                          <Loading type={LoadingType.ACTION} className="absolute inset-0 flex items-center justify-center bg-gray-900/50" />
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
                          <Loading type={LoadingType.ACTION} className="absolute inset-0 flex items-center justify-center bg-gray-900/50" />
                        ) : (
                          renderStatusSelect(order)
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Product Image */}
                  <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-800">
                    {productInfo.imageUrl ? (
                      <OptimizedImage
                        src={productInfo.imageUrl}
                        alt={productInfo.name}
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
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Order Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm truncate">{productInfo.name}</h3>
                          {productInfo.collectionName && (
                            <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full shrink-0">
                              {productInfo.collectionName}
                            </span>
                          )}
                        </div>
                        {productInfo.sku && (
                          <p className="text-xs text-gray-400">SKU: {productInfo.sku}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {productInfo.categoryName && (
                            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                              {productInfo.categoryName}
                            </span>
                          )}
                          {productInfo.variants && productInfo.variants.length > 0 && (
                            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                              {productInfo.variants.map((v: OrderVariant) => `${v.name}: ${v.value}`).join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <p className="text-gray-400 text-xs">Amount: {order.amountSol} SOL</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {renderPaymentMetadataTags(order)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tracking Number Section */}
                    {renderTrackingSection(order)}

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
                        {/* Wallet Address */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">Wallet:</span>
                          <a
                            href={`https://solscan.io/account/${order.walletAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1"
                          >
                            {order.walletAddress.slice(0, 8)}...{order.walletAddress.slice(-8)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {order.transactionSignature ? (
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
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Transaction:</span>
                            <span className="text-xs text-gray-500">Pending</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}