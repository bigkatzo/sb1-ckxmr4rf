import { supabase } from '../lib/supabase';
import type { Coupon, CouponResult, PriceWithDiscount } from '../types/coupons';

export class CouponService {
  static async validateCoupon(code: string): Promise<CouponResult> {
    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('status', 'active')
        .single() as { data: Coupon | null; error: any };

      if (error || !coupon) {
        return {
          isValid: false,
          discountAmount: 0,
          error: 'Invalid coupon code'
        };
      }

      return {
        isValid: true,
        discountAmount: 0 // Will be calculated based on price
      };
    } catch (error) {
      console.error('Error validating coupon:', error);
      return {
        isValid: false,
        discountAmount: 0,
        error: 'Error validating coupon'
      };
    }
  }

  static async calculateDiscount(
    modifiedPrice: number,
    code: string
  ): Promise<PriceWithDiscount> {
    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('status', 'active')
        .single() as { data: Coupon | null; error: any };

      // If any error or no coupon, return original price
      if (error || !coupon) {
        return {
          finalPrice: modifiedPrice,
          couponDiscount: 0,
          originalPrice: modifiedPrice
        };
      }

      let discountAmount = 0;
      let discountDisplay = '';

      // Calculate discount based on type
      if (coupon.discount_type === 'fixed_sol') {
        discountAmount = Math.min(coupon.discount_value, modifiedPrice);
        discountDisplay = `${discountAmount} SOL off`;
      } else {
        discountAmount = (modifiedPrice * coupon.discount_value) / 100;
        if (coupon.max_discount) {
          discountAmount = Math.min(discountAmount, coupon.max_discount);
        }
        discountDisplay = `${coupon.discount_value}% off`;
      }

      // Ensure we don't discount more than the price
      discountAmount = Math.min(discountAmount, modifiedPrice);

      return {
        finalPrice: modifiedPrice - discountAmount,
        couponDiscount: discountAmount,
        originalPrice: modifiedPrice,
        discountDisplay,
        couponCode: code
      };
    } catch (error) {
      console.error('Error calculating discount:', error);
      // Fallback to original price if anything goes wrong
      return {
        finalPrice: modifiedPrice,
        couponDiscount: 0,
        originalPrice: modifiedPrice
      };
    }
  }
} 