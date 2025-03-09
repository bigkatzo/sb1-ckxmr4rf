import type { Product } from './index';

export interface ShippingAddress {
  address: string;
  city: string;
  country: string;
  zip: string;
}

export interface ContactInfo {
  method: string;
  value: string;
}

export interface OrderVariant {
  name: string;
  value: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  product_id: string;
  collection_id: string;
  product_name: string;
  product_sku: string;
  product_image_url: string;
  collection_name: string;
  amountSol: number;
  category_name?: string;
  shippingAddress?: ShippingAddress;
  contactInfo?: ContactInfo;
  walletAddress: string;
  transactionSignature: string;
  access_type?: 'admin' | 'owner' | 'edit' | 'view';
  product?: Product;
  order_variants?: OrderVariant[];
}

// Type for the public order counts view
export interface PublicOrderCount {
  product_id: string;
  collection_id: string;
  total_orders: number;
}

// This interface is used for the merchant_orders view
export interface MerchantOrder extends Omit<Order, 'product_id' | 'collection_id'> {
  product_id: string | null;
  collection_id: string | null;
}