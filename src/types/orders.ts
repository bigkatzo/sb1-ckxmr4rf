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
  product_name: string;
  product_sku: string | null;
  collection_name: string;
  product?: {
    id: string;
    imageUrl?: string;
    variants?: { name: string; value: string }[];
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
  product_snapshot?: ProductSnapshot;
  collection_snapshot?: CollectionSnapshot;
  walletAddress: string;
  transactionSignature: string;
  shippingAddress: any; // JSONB in database
  contactInfo: any; // JSONB in database
  status: OrderStatus;
  amountSol: number;
  createdAt: Date;
  updatedAt: Date;
  access_type?: string | null;
  order_variants?: OrderVariant[]; // Selected variants for this order
}

// Type for the public order counts view
export interface PublicOrderCount {
  product_id: string;
  collection_id: string;
  total_orders: number;
}

// Type for merchant orders view
export interface MerchantOrder extends Order {
  product_id: string | null;
  product_image_url: string | null;
  product_variants: { name: string; value: string }[];
  product_variant_prices: Record<string, number>;
  collection_id: string;
  collection_owner_id: string;
  category_name: string | null;
  category_description: string | null;
  category_type: string | null;
  variant_selections: { name: string; value: string }[];
  access_type: string | null;
}