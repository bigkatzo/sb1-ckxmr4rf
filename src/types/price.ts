export interface PriceWithDiscount {
  originalPrice: number;
  finalPrice: number;
  couponCode?: string;
  couponDiscount: number;
  discountDisplay?: string;
  error?: string;
} 