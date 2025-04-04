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

export interface Order {
  id: string;
  order_number: string;
  collection_id: string;
  product_id: string;
  walletAddress: string;
  transactionSignature: string;
  shippingAddress: {
    address: string;
    city: string;
    country: string;
    zip: string;
  };
  contactInfo: {
    method: string;
    value: string;
    fullName?: string;
    phoneNumber?: string;
  };
  status: OrderStatus;
  amountSol: number;
  createdAt: Date;
  updatedAt: Date;
  product_name: string;
  product_sku: string;
  product_image_url: string;
  collection_name: string;
  category_name: string;
  category_description: string;
  category_type: string;
  access_type?: string;
  order_variants: Array<{
    name: string;
    value: string;
  }>;
  product_variants: Array<{
    id: string;
    name: string;
    values: string[];
  }>;
  product_variant_prices: Record<string, number>;
  tracking?: OrderTracking;
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