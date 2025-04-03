export type DiscountType = 'fixed_sol' | 'percentage';

export interface Coupon {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  status: 'active' | 'inactive';
  createdAt: Date;
}

export interface CouponResult {
  isValid: boolean;
  discountAmount: number;
  error?: string;
}

export type PriceWithDiscount = {
  finalPrice: number;
  couponDiscount: number;
  originalPrice: number;
  discountDisplay?: string;
  couponCode?: string;
}; 