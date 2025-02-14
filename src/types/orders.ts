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

export interface Order {
  id: string;
  orderNumber: string;
  product: OrderProduct;
  variants?: OrderVariant[];
  shippingInfo: OrderShippingInfo;
  transactionId: string;
  transactionStatus: 'pending' | 'confirmed' | 'failed';
  walletAddress: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}