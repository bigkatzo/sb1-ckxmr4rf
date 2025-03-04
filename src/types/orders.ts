export interface OrderVariant {
  name: string;
  value: string;
}

export interface OrderShippingInfo {
  address: string;
  contactMethod: string;
  contactValue: string;
}

export interface OrderProduct {
  name: string;
  sku: string;
  price: number;
  imageUrl?: string;
  collection?: {
    name: string;
  };
  category?: {
    name: string;
  };
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface ProductSnapshot {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  images?: string[];
  variants?: { name: string; value: string }[];
  variant_prices?: Record<string, number>;
  category?: {
    id: string;
    name: string;
  };
}

export interface CollectionSnapshot {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  createdAt: Date;
  amountSol: number;
  walletAddress: string;
  transactionSignature: string;
  shippingAddress?: {
    address: string;
    city: string;
    country: string;
    zip: string;
  };
  contactInfo?: {
    method: string;
    value: string;
  };
  order_variants?: {
    name: string;
    value: string;
  }[];
  
  // New denormalized fields
  product_id: string;
  product_name: string;
  product_sku?: string;
  collection_id: string;
  collection_name: string;
  category_name?: string;
  
  // Keep these for backward compatibility and additional data
  product?: {
    id: string;
    imageUrl?: string;
    variants?: { name: string; value: string; }[];
    variantPrices?: Record<string, number>;
    category?: {
      name: string;
      description?: string;
      type?: string;
    };
    collection: {
      id: string;
      ownerId?: string;
    };
  };
  product_snapshot?: {
    name: string;
    sku?: string;
    images?: string[];
    variants?: { name: string; value: string; }[];
    variant_prices?: Record<string, number>;
    category?: {
      name: string;
      description?: string;
      type?: string;
    };
  };
  collection_snapshot?: {
    name: string;
    ownerId?: string;
  };
  access_type: 'admin' | 'owner' | 'edit' | 'view';
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