import { supabase } from '../lib/supabase';
import type { Coupon, CouponResult, PriceWithDiscount } from '../types/coupons';
import { verifyTokenHolding } from '../utils/token-verification';
import { verifyNFTHolding } from '../utils/nft-verification';
import { verifyWhitelistAccess } from '../utils/whitelist-verification';

export class CouponService {
  static async validateCoupon(coupons: any, walletAddress: string, productCollectionId: Array<string>): Promise<CouponResult> {
    try {
      if (!coupons) {
        return {
          isValid: false,
          discountAmount: 0,
          error: 'Invalid coupon code'
        };
      }

      // Check if coupon is restricted to specific collections
      if (productCollectionId && Array.isArray(coupons.collection_ids) && coupons.collection_ids.length > 0) {
        if (!coupons.collection_ids.includes(productCollectionId)) {
          return {
            isValid: false,
            discountAmount: 0,
            error: 'This coupon is not valid for this product'
          };
        }
      }

      // Check eligibility rules if they exist
      if (coupons.eligibility_rules?.groups?.length) {
        // Verify each group of rules
        const groupResults = await Promise.all(
          coupons.eligibility_rules.groups.map(async group => {
            // Verify all rules in the group
            const ruleResults = await Promise.all(
              group.rules.map(async rule => {
                switch (rule.type) {
                  case 'token':
                    return verifyTokenHolding(walletAddress, rule.value, rule.quantity === undefined ? 1 : rule.quantity);
                  case 'nft':
                    return verifyNFTHolding(walletAddress, rule.value, rule.quantity === undefined ? 1 : rule.quantity);
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
    walletAddress: string,
    // Array of strings
    productCollectionId: Array<string>
  ): Promise<PriceWithDiscount> {
    try {
      const { data: coupons, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('status', 'active')
        .single() as { data: Coupon | null; error: any };

      // If any error or no coupon, return original price
      if (error || !coupons) {
        return {
          finalPrice: modifiedPrice,
          couponDiscount: 0,
          originalPrice: modifiedPrice
        };
      }

      // First validate eligibility
      const eligibilityResult = await this.validateCoupon(coupons, walletAddress, productCollectionId);
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
      // do not calculate the discount at all...
      if (coupons.discount_type === 'fixed_sol') {
        discountAmount = Math.min(coupons.discount_value, modifiedPrice);
        discountDisplay = `${discountAmount} SOL off`;
        console.log('Fixed SOL discount calculation:', {
          couponCode: code,
          discountValue: coupons.discount_value,
          modifiedPrice,
          finalDiscount: discountAmount,
          percentageOfPrice: ((discountAmount / modifiedPrice) * 100).toFixed(2) + '%'
        });
      } else {
        discountAmount = (modifiedPrice * coupons.discount_value) / 100;
        if (coupons.max_discount) {
          discountAmount = Math.min(discountAmount, coupons.max_discount);
        }
        discountDisplay = `${coupons.discount_value}% off`;
        console.log('Percentage discount calculation:', {
          couponCode: code,
          percentageValue: coupons.discount_value + '%',
          modifiedPrice,
          calculatedDiscount: (modifiedPrice * coupons.discount_value) / 100,
          maxDiscount: coupons.max_discount,
          finalDiscount: discountAmount
        });
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