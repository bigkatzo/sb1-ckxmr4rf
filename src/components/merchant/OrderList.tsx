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
  CreditCard,
  Tag,
  Search,
  PackageOpen,
  Ban
} from 'lucide-react';
import { formatDistanceToNow, subDays, isAfter, startOfDay, format, parseISO, isBefore, isEqual, subYears } from 'date-fns';
import type { Order, OrderStatus, OrderVariant } from '../../types/orders';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { OrderAnalytics } from './OrderAnalytics';
import { toast } from 'react-toastify';
import { OptimizedImage } from '../ui/OptimizedImage';
import { ImageIcon } from 'lucide-react';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { Button } from '../ui/Button';
import { addTracking, deleteTracking } from '../../services/tracking';
import { 
  getTransactionUrl, 
  formatTransactionSignature, 
  getTransactionLabel
} from '../../utils/transactions';
import DeleteTrackingButton from '../tracking/DeleteTrackingButton';
import { SensitiveInfo } from '../ui/SensitiveInfo';
import { OrderShippingAddress } from '../OrderShippingAddress';
import { RefreshButton } from '../ui/RefreshButton';

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

// Update carrier type definition
type Carrier = {
  key: number;
  name_en: string;
  name_cn: string;
  name_hk: string;
  url: string;
};

interface OrderListProps {
  orders: Order[];
  onStatusUpdate?: (orderId: string, status: OrderStatus) => Promise<void>;
  onTrackingUpdate?: (orderId: string, trackingNumber: string, carrier?: string) => Promise<void>;
  refreshOrders?: () => Promise<void>;
}

export function OrderList({ orders, onStatusUpdate, onTrackingUpdate, refreshOrders }: OrderListProps) {
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [editingTrackingId, setEditingTrackingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  // Update carriers state type
  const [carriers, setCarriers] = useState<Array<Carrier & { key: number }>>([]);
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [carrierSearchTerm, setCarrierSearchTerm] = useState('');
  const [showAllCarriers, setShowAllCarriers] = useState(false);
  
  // Base URL for product and design links
  const BASE_URL = 'https://store.fun';
  
  // Helper function to get product and collection slugs from various sources
  const getSlugs = (order: Order) => {
    let productSlug = '';
    let collectionSlug = '';
    
    // Try direct properties first
    if (order.product_slug) {
      productSlug = order.product_slug;
    }
    if (order.collection_slug) {
      collectionSlug = order.collection_slug;
    }
    
    // Try product_snapshot
    if (!productSlug && order.product_snapshot?.slug) {
      productSlug = order.product_snapshot.slug;
    }
    
    // Try collection_snapshot
    if (!collectionSlug && order.collection_snapshot?.slug) {
      collectionSlug = order.collection_snapshot.slug;
    }
    
    return { productSlug, collectionSlug };
  };

  // Function to check if user has permission to edit order status
  const canEditOrderStatus = (order: Order): boolean => {
    // Remove debug logging to reduce console spam
    if (!order.access_type) return false;
    return ['admin', 'owner', 'edit'].includes(order.access_type);
  };
  
  // Update carrier data processing in the useEffect
  useEffect(() => {
    const loadCarriers = async () => {
      setIsLoadingCarriers(true);
      try {
        console.log('Fetching carriers from /data/carriers.json');
        
        // Try to fetch carriers with multiple fallback URLs
        let response;
        let carrierData;
        let success = false;
        
        try {
          // First try with relative path
          response = await fetch('/data/carriers.json');
          if (response.ok) {
            carrierData = await response.json();
            success = true;
            console.log('Successfully loaded carriers from relative path');
          }
        } catch (err) {
          console.warn('Failed to load carriers from relative path:', err);
        }
        
        // If first attempt failed, try with window.location.origin
        if (!success) {
          try {
            const baseUrl = window.location.origin;
            console.log(`Trying alternate URL: ${baseUrl}/data/carriers.json`);
            response = await fetch(`${baseUrl}/data/carriers.json`);
            if (response.ok) {
              carrierData = await response.json();
              success = true;
              console.log('Successfully loaded carriers from absolute path');
            } else {
              console.error(`Failed to fetch from ${baseUrl}/data/carriers.json: Status ${response.status}`);
            }
          } catch (err) {
            console.warn('Failed to load carriers from absolute path:', err);
          }
        }
        
        // If still no success, try with CDN URL
        if (!success) {
          try {
            const cdnUrl = 'https://store.fun/data/carriers.json';
            console.log(`Trying CDN URL: ${cdnUrl}`);
            response = await fetch(cdnUrl);
            if (response.ok) {
              carrierData = await response.json();
              success = true;
              console.log('Successfully loaded carriers from CDN');
            } else {
              console.error(`Failed to fetch from CDN: Status ${response.status}`);
            }
          } catch (err) {
            console.warn('Failed to load carriers from CDN:', err);
          }
        }
        
        if (!success) {
          throw new Error('Failed to load carriers from any source');
        }

        // Transform the carrier data to match the new format
        let parsedCarriers: Array<Carrier & { key: number }> = [];
        
        if (typeof carrierData === 'object' && carrierData !== null) {
          parsedCarriers = Object.entries(carrierData).map(([id, details]: [string, any]) => ({
            key: parseInt(id, 10),
            name_en: details.name_en || details.name || '',
            name_cn: details.name_cn || details.name_en || details.name || '',
            name_hk: details.name_hk || details.name_en || details.name || '',
            url: details.url || ''
          }));
        }
        
        console.log(`Loaded ${parsedCarriers.length} carriers`);
        setCarriers(parsedCarriers);
      } catch (error) {
        console.error('Failed to load carrier list:', error);
        toast.error('Failed to load carrier list. Some features may be limited.');
        setCarriers([]);
      } finally {
        setIsLoadingCarriers(false);
      }
    };

    loadCarriers();
  }, []);
  
  // Update carrier filtering to use name_en
  const filteredCarriers = useMemo(() => {
    if (!Array.isArray(carriers)) return [];
    
    if (!carrierSearchTerm.trim()) return carriers;
    
    const searchLower = carrierSearchTerm.toLowerCase();
    return carriers.filter(carrier => 
      carrier.name_en.toLowerCase().includes(searchLower)
    );
  }, [carriers, carrierSearchTerm]);

  // Get common carriers for quick selection
  const commonCarriers = useMemo(() => {
    if (!Array.isArray(carriers)) return [];
    
    // Common carrier codes: USPS, FedEx, UPS, DHL, China Post, etc.
    const commonCarrierIds = [21051, 100003, 100001, 7041, 7042, 190094, 100027];
    return carriers.filter(c => commonCarrierIds.includes(c.key));
  }, [carriers]);

  // Limit displayed carriers when not searching to prevent dropdown from being too large
  const displayedCarriers = useMemo(() => {
    if (!Array.isArray(filteredCarriers)) return [];
    
    if (carrierSearchTerm.trim() || showAllCarriers) {
      return filteredCarriers;
    }
    // Show only top carriers when not searching
    return filteredCarriers.slice(0, 100);
  }, [filteredCarriers, carrierSearchTerm, showAllCarriers]);
  
  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    if (!onStatusUpdate) return;
    
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Check if user has permission to edit order status
    if (!canEditOrderStatus(order)) {
      console.error(`Permission denied: Cannot update order ${orderId} status. Access type: ${order.access_type}`);
      toast.error('You do not have permission to update this order');
      return;
    }
    
    try {
      console.log(`Updating order ${orderId} status to ${status}. Access type: ${order.access_type}`);
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

  const handleTrackingUpdate = async (orderId: string, trackingNumber: string, carrier: string = '') => {
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      console.error('Order not found:', orderId);
      toast.error('Order not found');
      return;
    }

    // Check if user has permission to edit order
    if (!canEditOrderStatus(order)) {
      console.error(`Permission denied: Cannot update tracking for order ${orderId}. Access type: ${order.access_type}`);
      toast.error('You do not have permission to update this order');
      return;
    }
    
    try {
      console.log(`Adding tracking for order ${orderId}: ${trackingNumber}, carrier: ${carrier || 'not specified'}. Access type: ${order.access_type}`);
      
      // If tracking number is empty, treat it as a removal (though this shouldn't happen with UI changes)
      if (!trackingNumber.trim()) {
        // Get the existing tracking number for removal from 17TRACK
        const existingTrackingNumber = order.tracking?.tracking_number;
        
        if (existingTrackingNumber) {
          console.log(`Removing tracking number: ${existingTrackingNumber}`);
          try {
            // Call the tracking service to delete the tracking
            const result = await deleteTracking(existingTrackingNumber);
            console.log('Delete tracking result:', result);
            
            if (result.success) {
              toast.success('Tracking number removed successfully');
            } else {
              console.warn('Partial success deleting tracking:', result);
              toast.warning(result.message || 'Tracking partially removed');
            }
          } catch (deleteError) {
            console.error('Error deleting tracking:', deleteError);
            toast.error(`Error deleting tracking: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`);
          }
        }
        
        // Update the order with empty tracking
        if (onTrackingUpdate) {
          try {
            console.log('Updating order with empty tracking');
            await onTrackingUpdate(orderId, '', '');
          } catch (updateError) {
            console.error('Error removing tracking from order:', updateError);
            toast.error(`Error removing tracking: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
            throw updateError;
          }
        }
      } else {
        // Flow for adding new tracking
        if (onTrackingUpdate) {
          try {
            // Find carrier name if ID is provided
            let carrierName = carrier || '';
            if (carrier && !isNaN(Number(carrier)) && Array.isArray(carriers)) {
              const carrierKey = Number(carrier);
              const carrierObj = carriers.find(c => c.key === carrierKey);
              if (carrierObj) {
                carrierName = carrierObj.name_en;
              }
            }
            
            console.log(`Adding tracking to order ${orderId}: ${trackingNumber}, carrier: ${carrierName || carrier || 'not specified'}`);
            await onTrackingUpdate(orderId, trackingNumber, carrier);
          } catch (updateError) {
            console.error('Error adding tracking to order:', updateError);
            toast.error(`Error adding tracking: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
            throw updateError;
          }
        } else {
          try {
            console.log(`Adding tracking via service: ${trackingNumber}, carrier: ${carrier || 'not specified'}`);
            await addTracking(orderId, trackingNumber, carrier || 'usps');
          } catch (addError) {
            console.error('Error adding tracking:', addError);
            toast.error(`Error adding tracking: ${addError instanceof Error ? addError.message : 'Unknown error'}`);
            throw addError;
          }
        }
        toast.success('Tracking number added successfully');
      }
      
      setEditingTrackingId(null);
      setCarrierSearchTerm('');
      setShowAllCarriers(false);
    } catch (error) {
      console.error('Failed to add tracking number:', error);
      toast.error(`Failed to add tracking number: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Define the headers and mapping according to the specified format
      const csvMapping = {
        "SKU Code": null,
        "Store ID": null,
        "Order Number": "order_number",
        "Hypersku Quantity": "quantity",
        "First Name": "contact_info.firstName",
        "Last Name": "contact_info.lastName",
        "Address1": "shipping_info.address",
        "Address2": null,
        "City": "shipping_info.city",
        "Province": "shipping_info.state",
        "Country": "shipping_info.country",
        "Zip": "shipping_info.zip",
        "Phone Number": "contact_info.phoneNumber",
        "Tracking URL": null,
        "Product SKU": "product_sku",
        "Product Name": "product_name",
        "Variant Selections": "variant_selections",
        "Collection": "collection_name",
        "Category": "category_name",
        "Tax ID": "shipping_info.taxId",
        "Product URL": "generated_product_url",
        "Design URL": "generated_design_url",
        "Design Files": "design_files",
        "Blank Code": "blank_code",
        "Technique": "technique",
        "Notes For Supplier": "note_for_supplier",
        "Contact": "contact_value",
        "Contact Method": "contact_info.method",
        "Wallet Address": "wallet_address",
        "Transaction": "transaction_signature",
        "SOL Amount": "ammount_sol",
        "Payment Metadata": "payment_metadata"
      };

      const headers = Object.keys(csvMapping);

      const escapeCSV = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes('"') || str.includes(',') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = filteredOrders.map((order, index) => {
        try {
          const row = headers.map(header => {
            const fieldPath = csvMapping[header as keyof typeof csvMapping];
            
            if (!fieldPath) return '';
            
            // Handle special fields with dot notation (nested properties)
            if (fieldPath.includes('.')) {
              const [parent, child] = fieldPath.split('.');
              
              if (parent === 'contact_info') {
                if (child === 'full_name' && order.contactInfo) {
                  return escapeCSV(`${order.contactInfo.firstName || ''} ${order.contactInfo.lastName || ''}`);
                }
                if (child === 'firstName' && order.contactInfo) {
                  return escapeCSV(order.contactInfo.firstName || '');
                }
                if (child === 'lastName' && order.contactInfo) {
                  return escapeCSV(order.contactInfo.lastName || '');
                }
                if (child === 'method' && order.contactInfo) {
                  return escapeCSV(order.contactInfo.method || '');
                }
                if (child === 'phoneNumber' && order.contactInfo) {
                  return escapeCSV(order.contactInfo.phoneNumber || '');
                }
              }
              
              if (parent === 'shipping_info') {
                if (child === 'address' && order.shippingAddress) {
                  return escapeCSV(order.shippingAddress.address || '');
                }
                if (child === 'city' && order.shippingAddress) {
                  return escapeCSV(order.shippingAddress.city || '');
                }
                if (child === 'state' && order.shippingAddress) {
                  return escapeCSV(order.shippingAddress.state || '');
                }
                if (child === 'country' && order.shippingAddress) {
                  return escapeCSV(order.shippingAddress.country || '');
                }
                if (child === 'zip' && order.shippingAddress) {
                  return escapeCSV(order.shippingAddress.zip || '');
                }
                if (child === 'taxId' && order.shippingAddress) {
                  return escapeCSV(order.shippingAddress.taxId || '');
                }
              }
              
              return '';
            }
            
            // Handle direct field mappings
            switch (fieldPath) {
              case 'order_number':
                return escapeCSV(order.order_number);
              case 'quantity':
                return escapeCSV('1'); // Always 1 until we support multiple items per order
              case 'product_sku':
                return escapeCSV(order.product_sku || '');
              case 'product_name':
                return escapeCSV(order.product_name || '');
              case 'collection_name':
                return escapeCSV(order.collection_name || '');
              case 'category_name':
                return escapeCSV(order.category_name || '');
              case 'generated_product_url':
                // First try to use the pre-built URL if available
                if (order.product_url) {
                  return escapeCSV(order.product_url);
                } else if (order.product_snapshot?.product_url) {
                  return escapeCSV(order.product_snapshot.product_url);
                }
                
                // Fall back to constructing the URL
                const { productSlug: pSlug, collectionSlug: cSlug } = getSlugs(order);
                
                if (cSlug && pSlug) {
                  // Preferred: Collection/product slug URL
                  return escapeCSV(`${BASE_URL}/${cSlug}/${pSlug}`);
                } else if (order.product_id) {
                  // Fallback: Product ID URL
                  return escapeCSV(`${BASE_URL}/products/${order.product_id}`);
                } else if (order.product_snapshot?.id) {
                  // Last resort: Product snapshot ID
                  return escapeCSV(`${BASE_URL}/products/${order.product_snapshot.id}`);
                }
                return '';
              case 'generated_design_url':
                // First try to use the pre-built URL if available
                if (order.design_url) {
                  return escapeCSV(order.design_url);
                } else if (order.product_snapshot?.design_url) {
                  return escapeCSV(order.product_snapshot.design_url);
                }
                
                // Fall back to constructing the URL
                const { productSlug, collectionSlug } = getSlugs(order);
                
                if (collectionSlug && productSlug) {
                  // Preferred: Collection/product slug URL with design
                  return escapeCSV(`${BASE_URL}/${collectionSlug}/${productSlug}/design`);
                } else if (order.product_id) {
                  // Fallback: Product ID URL with design
                  return escapeCSV(`${BASE_URL}/products/${order.product_id}/design`);
                } else if (order.product_snapshot?.id) {
                  // Last resort: Product snapshot ID with design
                  return escapeCSV(`${BASE_URL}/products/${order.product_snapshot.id}/design`);
                }
                return '';
              case 'design_files':
                if (order.product_snapshot && order.product_snapshot.design_files) {
                  const files = order.product_snapshot.design_files;
                  return escapeCSV(Array.isArray(files) ? files.join(', ') : files);
                }
                return '';
              case 'blank_code':
                return escapeCSV((order.product_snapshot && order.product_snapshot.blank_code) || '');
              case 'technique':
                return escapeCSV((order.product_snapshot && order.product_snapshot.technique) || '');
              case 'note_for_supplier':
                return escapeCSV((order.product_snapshot && order.product_snapshot.note_for_supplier) || '');
              case 'variant_selections':
                // Use the same approach as getProductInfo since it's working in the UI
                const variantData = 
                  (order.variant_selections && Array.isArray(order.variant_selections) && order.variant_selections.length > 0) ? order.variant_selections :
                  (order.order_variants && Array.isArray(order.order_variants) && order.order_variants.length > 0) ? order.order_variants : 
                  [];
                
                if (variantData.length > 0) {
                  return escapeCSV(variantData.map(v => `${v.name}: ${v.value}`).join(', '));
                }
                return '';
              case 'contact_value':
                return order.contactInfo ? escapeCSV(order.contactInfo.value || '') : '';
              case 'wallet_address':
                return escapeCSV(order.walletAddress || '');
              case 'transaction_signature':
                return escapeCSV(order.transactionSignature || '');
              case 'ammount_sol':
                return escapeCSV(typeof order.amountSol === 'number' ? order.amountSol.toFixed(2) : '');
              case 'payment_metadata':
                return order.payment_metadata ? escapeCSV(JSON.stringify(order.payment_metadata)) : '';
              default:
                return '';
            }
          });
          
          return row;
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

  // Group orders by batch ID for displaying batched orders together
  const groupOrdersByBatch = useCallback((orders: Order[]) => {
    // Create a map of batch_order_id to count of related orders
    const batchSizeMap = new Map<string, number>();
    
    // Count orders per batch
    orders.forEach(order => {
      if (order.batch_order_id) {
        const count = batchSizeMap.get(order.batch_order_id) || 0;
        batchSizeMap.set(order.batch_order_id, count + 1);
      }
    });
    
    // Return individual orders with batch info
    return orders
      .map(order => {
        // Add batch info to the order objects
        const orderWithBatchInfo = {...order} as Order & {
          _batchSize?: number;
          _isPartOfBatch?: boolean;
        };
        
        if (order.batch_order_id) {
          orderWithBatchInfo._batchSize = batchSizeMap.get(order.batch_order_id) || 1;
          orderWithBatchInfo._isPartOfBatch = true;
        }
        
        return [orderWithBatchInfo]; // Wrap in array to maintain structure
      })
      .sort((a, b) => new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime());
  }, []);

  // Group the filtered orders by batch
  const groupedOrders = useMemo(() => {
    return groupOrdersByBatch(filteredOrders);
  }, [filteredOrders, groupOrdersByBatch]);

  const getStatusIcon = (status: Order['status']) => {
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
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return { bgColor: 'bg-gray-500/10', color: 'text-gray-400' };
      case 'pending_payment':
        return { bgColor: 'bg-yellow-500/10', color: 'text-yellow-500' };
      case 'confirmed':
        return { bgColor: 'bg-blue-500/10', color: 'text-blue-400' };
      case 'preparing':
        return { bgColor: 'bg-orange-500/10', color: 'text-orange-400' };
      case 'shipped':
        return { bgColor: 'bg-teal-500/10', color: 'text-teal-400' };
      case 'delivered':
        return { bgColor: 'bg-green-500/10', color: 'text-green-400' };
      case 'cancelled':
        return { bgColor: 'bg-red-500/10', color: 'text-red-400' };
      default:
        return { bgColor: 'bg-gray-500/10', color: 'text-gray-400' };
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
      // Display coupon code if available, otherwise fallback to calculated percentage
      if (order.payment_metadata.couponCode) {
        tags.push(
          <span 
            key="discount"
            className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1"
            title="Coupon applied"
          >
            <Tag className="h-3 w-3" />
            <span>{order.payment_metadata.couponCode}</span>
          </span>
        );
      } else {
        // Fallback to percentage calculation if no coupon code is available
        let discountPercent = 0;
        
        if (order.payment_metadata.originalPrice > 0) {
          discountPercent = Math.min(
            100,
            Math.round((order.payment_metadata.couponDiscount / order.payment_metadata.originalPrice) * 100)
          );
        }
        
        if (discountPercent > 0) {
          tags.push(
            <span 
              key="discount"
              className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1"
            >
              <Tag className="h-3 w-3" />
              <span>{discountPercent}% off</span>
            </span>
          );
        }
      }
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
    const { method, value, firstName, lastName, phoneNumber } = contactInfo;
    
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
    
    const contactContent = (
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
                className="text-gray-300 hover:text-gray-100 transition-colors"
              >
                {display}
              </a>
            ) : (
              <span className="text-gray-300">{display}</span>
            )}
          </div>
          {(firstName || lastName) && (
            <div className="text-sm text-gray-300">
              <span className="text-gray-400">Name:</span> {firstName} {lastName}
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
    
    return (
      <SensitiveInfo type="blur">
        {contactContent}
      </SensitiveInfo>
    );
  };

  const formatShippingAddress = (shippingAddress: any) => {
    if (!shippingAddress) return null;
    return <OrderShippingAddress address={shippingAddress} />;
  };

  const getProductInfo = (order: Order) => {
    // Get variant data from any available source in order of preference
    const variantData = 
      (order.variant_selections && Array.isArray(order.variant_selections) && order.variant_selections.length > 0) ? order.variant_selections :
      (order.order_variants && Array.isArray(order.order_variants) && order.order_variants.length > 0) ? order.order_variants : 
      [];
    
    return {
      name: order.product_name,
      sku: order.product_sku,
      imageUrl: order.product_image_url,
      collectionName: order.collection_name,
      categoryName: order.category_name,
      variants: variantData,
      variantPrices: order.product_variant_prices
    };
  };

  const renderStatusSelect = (order: Order) => {
    // Use the canEditOrderStatus function for consistency
    const canEdit = canEditOrderStatus(order);
    
    if (!canEdit) {
      return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs ${getStatusColor(order.status).bgColor} ${getStatusColor(order.status).color}`}>
          {getStatusIcon(order.status)}
          <span className="capitalize">{order.status.replace('_', ' ')}</span>
        </div>
      );
    }

    // Define allowed status options based on current status
    let allowedStatuses = ['confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
    
    // If the order is already in draft or pending_payment, allow it to stay there
    // but don't allow changing to these statuses as they are part of the payment flow
    if (order.status === 'draft' || order.status === 'pending_payment') {
      allowedStatuses = [order.status, ...allowedStatuses];
    }

    return (
      <select
        value={order.status}
        onChange={(e) => handleStatusUpdate(order.id, e.target.value as OrderStatus)}
        disabled={updatingOrderId === order.id}
        className={`appearance-none cursor-pointer rounded px-2 py-1 pr-8 text-xs font-medium transition-colors relative ${getStatusColor(order.status).bgColor} ${getStatusColor(order.status).color}`}
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
            <div className="flex gap-2">
              {!order.tracking?.tracking_number && (
                <button
                  onClick={() => setEditingTrackingId(order.id)}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <Package className="h-3 w-3" />
                  Add Tracking
                </button>
              )}
              
              {order.tracking?.tracking_number && (
                <DeleteTrackingButton
                  trackingNumber={order.tracking.tracking_number}
                  onDeleted={() => {
                    // Refresh orders to update the UI
                    if (refreshOrders) {
                      void refreshOrders();
                    }
                  }}
                  disabled={isEditing}
                />
              )}
            </div>
          )}
        </div>
        
        {isEditing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const trackingInput = form.elements.namedItem('tracking') as HTMLInputElement;
              const carrierInput = form.elements.namedItem('carrier') as HTMLSelectElement;
              
              // Use carrier ID or empty string for auto-detection
              const carrierValue = carrierInput.value;
              const carrier = carrierValue === 'auto' ? '' : carrierValue;
              
              void handleTrackingUpdate(order.id, trackingInput.value.trim(), carrier);
            }}
            className="mt-2 flex flex-col gap-2"
          >
            <div className="flex flex-col md:flex-row gap-2">
              <div className="w-full md:w-2/3">
                <input
                  type="text"
                  name="tracking"
                  defaultValue={order.tracking?.tracking_number || ''}
                  placeholder="Enter tracking number"
                  className="w-full bg-gray-800 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                />
              </div>
              
              <div className="w-full md:w-1/3">
                {isLoadingCarriers ? (
                  <div className="flex items-center justify-center h-12 bg-gray-800 rounded-lg">
                    <Loading type={LoadingType.ACTION} text="Loading carriers..." />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative mb-2">
                      <input
                        type="text"
                        placeholder="Search carriers..."
                        value={carrierSearchTerm}
                        onChange={(e) => setCarrierSearchTerm(e.target.value)}
                        className="w-full bg-gray-800 text-gray-100 text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    
                    <select
                      name="carrier"
                      className="w-full bg-gray-800 text-gray-100 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      size={6}
                    >
                      <option value="auto">Auto-detect carrier</option>
                      
                      {commonCarriers.length > 0 && !carrierSearchTerm && (
                        commonCarriers.map((carrier) => (
                          <option key={carrier.key} value={carrier.key}>
                            {carrier.name_en}
                          </option>
                        ))
                      )}
                      
                      {displayedCarriers.length > 0 && (
                        (carrierSearchTerm ? displayedCarriers : displayedCarriers.filter(c => !commonCarriers.some(common => common.key === c.key)))
                          .map((carrier) => (
                            <option key={carrier.key} value={carrier.key}>
                              {carrier.name_en}
                            </option>
                          ))
                      )}
                    </select>
                    
                    <div className="text-xs text-gray-400 mt-1">
                      {displayedCarriers.length > 0 ? 
                        `Showing ${Math.min(displayedCarriers.length, carrierSearchTerm ? displayedCarriers.length : 100)} carriers` : 
                        carrierSearchTerm ? `No carriers found matching "${carrierSearchTerm}"` : 'No carriers available'}
                    </div>
                    
                    {!carrierSearchTerm && filteredCarriers.length > 100 && !showAllCarriers && (
                      <button
                        type="button"
                        onClick={() => setShowAllCarriers(true)}
                        className="mt-1 text-xs text-purple-400 hover:text-purple-300"
                      >
                        Show all {filteredCarriers.length} carriers
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-xs text-gray-400">
              Select a carrier or choose "Auto-detect" to let the system identify it
            </div>
            
            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg flex items-center gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingTrackingId(null);
                  setCarrierSearchTerm('');
                  setShowAllCarriers(false);
                }}
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
                  className="text-sm text-gray-300 hover:text-gray-100 flex items-center gap-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Truck className="h-3 w-3" />
                  {order.tracking.tracking_number}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {order.tracking.status && (
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(order.tracking.status).bgColor} ring-1 ring-white/10`} />
                    <div className={`text-xs ${getStatusColor(order.tracking.status).color}`}>
                      {order.tracking.status_details || order.tracking.status}
                    </div>
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
        {/* Order Counter and Refresh Button */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
          </span>
          {dateFilter !== 'all' && (
            <span className="text-xs text-gray-500">
              ({orders.length} total)
            </span>
          )}
          {refreshOrders && (
            <RefreshButton
              onRefresh={refreshOrders}
              className="text-gray-400 hover:text-gray-200"
            />
          )}
          {/* Export Button - Mobile only */}
          <Button
            onClick={() => void exportToCSV()}
            disabled={isExporting || filteredOrders.length === 0}
            variant="secondary"
            size="sm"
            isLoading={isExporting}
            className="sm:hidden flex items-center"
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Analytics Toggle */}
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded-md border border-gray-700 focus:ring-2 focus:ring-primary/40 focus:outline-none transition-colors"
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
              className="bg-gray-800 text-gray-200 text-sm rounded-md border border-gray-700 px-3 py-1.5 focus:ring-2 focus:ring-primary/40 focus:outline-none cursor-pointer min-w-[120px]"
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
                className="bg-gray-800 text-gray-200 text-sm rounded-md border border-gray-700 px-3 py-1.5 focus:ring-2 focus:ring-primary/40 focus:outline-none"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-800 text-gray-200 text-sm rounded-md border border-gray-700 px-3 py-1.5 focus:ring-2 focus:ring-primary/40 focus:outline-none"
              />
            </div>
          )}

          {/* Export Button - Desktop only */}
          <Button
            onClick={() => void exportToCSV()}
            disabled={isExporting || filteredOrders.length === 0}
            variant="secondary"
            size="sm"
            isLoading={isExporting}
            className="hidden sm:flex items-center gap-2"
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
            orders={filteredOrders}
            timeRange={{
              start: startDate ? new Date(startDate) : subYears(new Date(), 1),
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
        groupedOrders.map((group) => {
          const order = group[0];
          const productInfo = getProductInfo(order);
          const isBatchOrder = order._isPartOfBatch && order._batchSize && order._batchSize > 1;
          
          return (
            <div 
              key={order.id}
              className={`bg-gray-900 rounded-lg overflow-hidden ${isBatchOrder ? 'border-l-4 border-indigo-500/40' : ''}`}
            >
              {/* Order Header - Status Bar */}
              <div className={`bg-gray-800/50 px-3 sm:px-4 py-2 sm:py-3 ${isBatchOrder ? 'relative' : ''}`}>
                {isBatchOrder && (
                  <div className="absolute right-3 top-3 bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-xs">
                    Batch Order ({order._batchSize})
                  </div>
                )}
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
                          <div className="relative inline-flex items-center justify-center py-1.5 px-4">
                            <Loading type={LoadingType.ACTION} />
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
                          <div className="relative inline-flex items-center justify-center py-1.5 px-4">
                            <Loading type={LoadingType.ACTION} />
                          </div>
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
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
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
                        
                      </div>
                    </div>

                    {/* Price Section */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <div className="flex flex-col gap-2">
                          <p className="text-gray-400 text-xs">Amount: {order.amountSol} SOL</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {renderPaymentMetadataTags(order)}
                          </div>
                        </div>
                    </div>

                    {/* Quantity Section */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <div className="flex flex-col gap-2">
                          <p className="text-gray-400 text-xs">Quantity: *<b>{order.total_items_in_batch ?? 1}</b></p>
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">Wallet:</span>
                          <a
                            href={`https://solscan.io/account/${order.walletAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-gray-300 hover:text-gray-100 flex items-center gap-1"
                          >
                            {order.walletAddress.slice(0, 8)}...{order.walletAddress.slice(-8)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {order.transactionSignature ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{getTransactionLabel(order.transactionSignature)}:</span>
                            <a
                              href={getTransactionUrl(order.transactionSignature)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-gray-300 hover:text-gray-100 flex items-center gap-1"
                            >
                              {formatTransactionSignature(order.transactionSignature)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">No transaction signature</span>
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