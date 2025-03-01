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

export interface Order {
  id: string;
  product: {
    id: string;
    name: string;
    imageUrl?: string;
    category?: {
      name: string;
    };
    collection: {
      id: string;
      name: string;
      ownerId?: string;
    };
  };
  walletAddress: string;
  transactionSignature: string;
  shippingAddress: any; // JSONB in database
  contactInfo: any; // JSONB in database
  status: OrderStatus;
  amountSol: number;
  createdAt: Date;
  updatedAt: Date;
  accessType?: string | null;
}

// Type for the public order counts view
export interface PublicOrderCount {
  product_id: string;
  collection_id: string;
  total_orders: number;
}

// Type for merchant orders view
export interface MerchantOrder extends Order {
  product_name: string;
  collection_name: string;
  collection_owner_id: string;
  access_type: string | null;
}