export interface ShippingAddress {
  address: string;
  city: string;
  country: string;
  zip: string;
}

export interface ContactInfo {
  method: string;
  value: string;
  fullName: string;
  phoneNumber: string;
}

export interface OrderVariant {
  name: string;
  value: string;
}

export type OrderStatus = 'draft' | 'pending_payment' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderTracking {
  id: string;
  order_id: string;
  tracking_number: string;
  carrier: string;
  status?: string;
  status_details?: string;
  estimated_delivery_date?: string;
  last_update?: string;
  created_at: string;
  updated_at: string;
  tracking_events?: TrackingEvent[];
  timeline?: {
    date: string;
    status: string;
    location?: string;
    description?: string;
  }[];
  order_details?: {
    order_number: string;
    product_name: string;
    shipping_address?: string;
  };
}

export interface TrackingEvent {
  id: string;
  tracking_id: string;
  status: string;
  details?: string;
  location?: string;
  timestamp: string;
  created_at: string;
}

export interface ProductSnapshot {
  id: string;
  name: string;
  sku: string;
  images: string[];
  variants: any[];
  variant_prices: Record<string, any>;
  // other product fields...
}

export interface CollectionSnapshot {
  id: string;
  name: string;
  // other collection fields...
}

// Add PaymentMetadata interface
export interface PaymentMetadata {
  paymentMethod?: 'stripe' | string;
  couponCode?: string;
  couponDiscount?: number;
  originalPrice?: number;
  [key: string]: any;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  product_id: string;
  collection_id: string;
  product_name: string;
  product_sku: string;
  collection_name: string;
  amountSol: number;
  category_name: string;
  shippingAddress: ShippingAddress;
  contactInfo: ContactInfo;
  walletAddress: string;
  transactionSignature?: string;
  variant_selections: OrderVariant[];
  product_snapshot: ProductSnapshot;
  collection_snapshot: CollectionSnapshot;
  payment_metadata?: PaymentMetadata;
  tracking: OrderTracking | null;
  access_type?: 'admin' | 'owner' | 'edit' | string;
  product_image_url?: string;
  order_variants?: OrderVariant[];
  product_variant_prices?: Record<string, any>;
}

// Type for the public order counts view
export interface OrderCounts {
  total: number;
  pending: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

// This interface is used for the merchant_orders view
export interface MerchantOrder extends Omit<Order, 'product_id' | 'collection_id'> {
  product_id: string | null;
  collection_id: string | null;
}