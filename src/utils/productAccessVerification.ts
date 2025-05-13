import { verifyTokenHolding } from './token-verification';
import { verifyNFTHolding } from './nft-verification';
import { verifyWhitelistAccess } from './whitelist-verification';
import type { CategoryRule } from '../types';
import { toast } from 'react-toastify';
import type { CartItemPriceInfo } from '../contexts/CartContext';

/**
 * Verifies if a user has access to a product based on its category rules
 * @param product - The product to verify access for
 * @param walletAddress - The user's wallet address
 * @returns A promise that resolves to a result object with isValid and optional error message
 */
export async function verifyProductAccess(product: any, walletAddress: string | null): Promise<{ isValid: boolean; error?: string }> {
  // If no wallet is connected, we can't verify
  if (!walletAddress) {
    return { isValid: false, error: 'Please connect your wallet to purchase this item' };
  }

  // If no category or no rule groups, user is eligible
  if (!product.category?.eligibilityRules?.groups?.length) {
    return { isValid: true };
  }

  try {
    // Verify each group of rules
    const groupResults = await Promise.all(
      product.category.eligibilityRules.groups.map(async (group: any) => {
        // Verify all rules in the group
        const ruleResults = await Promise.all(
          group.rules.map((rule: CategoryRule) => verifyRule(rule, walletAddress))
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

    return { isValid, error };
  } catch (error) {
    console.error('Verification error:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Verification failed'
    };
  }
}

/**
 * Verifies a single category rule against a wallet address
 */
async function verifyRule(rule: CategoryRule, walletAddress: string): Promise<{ isValid: boolean; error?: string }> {
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
}

/**
 * Helper function to handle adding a product to cart with access verification
 * @param product - The product to add to cart
 * @param walletAddress - The user's wallet address
 * @param addToCartFn - The cart's addToCart function
 * @param selectedOptions - Selected product options/variants
 * @param quantity - Quantity to add
 * @param showConnectWalletFn - Function to show wallet connection modal
 * @param priceInfo - Price information including modified price and variant adjustments
 * @param toggleCartFn - Function to toggle cart drawer
 * @returns A promise that resolves to a boolean indicating if the item was added
 */
export async function verifyAndAddToCart(
  product: any,
  walletAddress: string | null,
  addToCartFn: (product: any, selectedOptions: Record<string, string>, quantity: number, verified: boolean, priceInfo?: CartItemPriceInfo) => void,
  selectedOptions: Record<string, string>,
  quantity: number = 1,
  showConnectWalletFn?: () => void,
  priceInfo?: CartItemPriceInfo,
  toggleCartFn?: () => void
): Promise<boolean> {
  // Skip verification for products without access rules
  if (!product.category?.eligibilityRules?.groups?.length) {
    addToCartFn(product, selectedOptions, quantity, true, priceInfo);
    
    // Show success toast with View Cart option
    if (toggleCartFn) {
      toast.success(`Added to cart: ${product.name}. Click to view cart.`, {
        position: 'bottom-center',
        autoClose: 3000,
        hideProgressBar: false,
        onClick: () => toggleCartFn()
      });
    } else {
      toast.success(`Added to cart: ${product.name}`);
    }
    
    return true;
  }

  // If no wallet is connected, prompt to connect
  if (!walletAddress) {
    toast.warning("Please connect your wallet to purchase this item");
    if (showConnectWalletFn) {
      showConnectWalletFn();
    }
    return false;
  }

  // Verify access
  const result = await verifyProductAccess(product, walletAddress);
  
  if (result.isValid) {
    addToCartFn(product, selectedOptions, quantity, true, priceInfo);
    
    // Show success toast with View Cart option
    if (toggleCartFn) {
      toast.success(`Added to cart: ${product.name}. Click to view cart.`, {
        position: 'bottom-center',
        autoClose: 3000,
        hideProgressBar: false,
        onClick: () => toggleCartFn()
      });
    } else {
      toast.success(`Added to cart: ${product.name}`);
    }
    
    return true;
  } else {
    toast.error(`Access denied: ${result.error || 'You don\'t have access to this product'}`);
    return false;
  }
} 