import { useCallback } from 'react';
import { formatTokenPrice, formatPriceDifference } from '../utils/format';
import type { Product } from '../types/variants';

/**
 * Hook for token price formatting based on product configuration
 */
export function useTokenFormat(product?: Pick<Product, 'pricingToken'>) {
  const token = product?.pricingToken || 'SOL';
  
  // Format a price in the product's token
  const formatPrice = useCallback((price: number, options = {}) => {
    return formatTokenPrice(price, token, options);
  }, [token]);
  
  // Format a price with the token symbol
  const formatPriceWithSymbol = useCallback((price: number, options = {}) => {
    return formatTokenPrice(price, token, { showSymbol: true, ...options });
  }, [token]);
  
  // Format a price difference (for variants)
  const formatVariantPrice = useCallback((variantPrice: number, basePrice: number) => {
    return formatPriceDifference(variantPrice, basePrice, token);
  }, [token]);
  
  // Get appropriate step for input fields
  const getPriceStep = useCallback(() => {
    return token === 'USDC' ? '0.01' : '0.00000001';
  }, [token]);
  
  return {
    token,
    formatPrice,
    formatPriceWithSymbol,
    formatVariantPrice,
    getPriceStep
  };
} 