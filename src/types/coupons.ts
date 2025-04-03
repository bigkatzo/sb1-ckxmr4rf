export type DiscountType = 'fixed_sol' | 'percentage';

export interface Coupon {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount?: number;
  status: 'active' | 'inactive';
  created_at: Date;
  created_by?: string;
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