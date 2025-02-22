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
  orderNumber: string;
  status: OrderStatus;
  walletAddress: string;
  transactionId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    collection?: {
      id: string;
      name: string;
    };
    category?: {
      id: string;
      name: string;
    };
  };
  variants?: Array<{
    name: string;
    value: string;
  }>;
  shippingInfo: {
    address: string;
    contactType: string;
    contactValue: string;
  };
  createdAt: Date;
}