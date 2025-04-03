import { supabase } from '../lib/supabase';
import type { Coupon, CouponResult, PriceWithDiscount } from '../types/coupons';
import { verifyTokenHolding } from '../utils/token-verification';
import { verifyNFTHolding } from '../utils/nft-verification';
import { verifyWhitelistAccess } from '../utils/whitelist-verification';

export class CouponService {
  static async validateCoupon(code: string, walletAddress: string): Promise<CouponResult> {
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

      // Check eligibility rules if they exist
      if (coupon.eligibility_rules?.groups?.length) {
        // Verify each group of rules
        const groupResults = await Promise.all(
          coupon.eligibility_rules.groups.map(async group => {
            // Verify all rules in the group
            const ruleResults = await Promise.all(
              group.rules.map(async rule => {
                switch (rule.type) {
                  case 'token':
                    return verifyTokenHolding(walletAddress, rule.value, rule.quantity || 1);
                  case 'nft':
                    return verifyNFTHolding(walletAddress, rule.value, rule.quantity || 1);
                  case 'whitelist':
                    return verifyWhitelistAccess(walletAddress, rule.value);
                  default:
                    return { isValid: false, error: `Unknown rule type: ${rule.type}` };
                }
              })
            );

            if (group.operator === 'AND') {
              // All rules must pass for AND
              const isValid = ruleResults.every(result => result.isValid);
              const error = ruleResults.find(result => result.error)?.error;
              return { isValid, error };
            } else {
              // At least one rule must pass for OR
              const isValid = ruleResults.some(result => result.isValid);
              const error = isValid ? undefined : 'None of the requirements were met';
              return { isValid, error };
            }
          })
        );

        // All groups must pass (groups are always AND'ed together)
        const isValid = groupResults.every(result => result.isValid);
        const error = groupResults.find(result => !result.isValid)?.error;

        if (!isValid) {
          return {
            isValid: false,
            discountAmount: 0,
            error: error || 'You do not meet the eligibility requirements for this coupon'
          };
        }
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
    code: string,
    walletAddress: string
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

      // First validate eligibility
      const eligibilityResult = await this.validateCoupon(code, walletAddress);
      if (!eligibilityResult.isValid) {
        return {
          finalPrice: modifiedPrice,
          couponDiscount: 0,
          originalPrice: modifiedPrice,
          error: eligibilityResult.error
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