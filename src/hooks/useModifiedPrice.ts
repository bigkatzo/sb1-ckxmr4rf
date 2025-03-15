import { useMemo } from 'react';
import { useOrderStats } from './useOrderStats';
import { calculateModifiedPrice, calculatePriceModificationPercentage } from '../utils/price';
import { getVariantKey } from '../utils/variant-helpers';
import type { Product } from '../types/variants';

interface UseModifiedPriceResult {
  modifiedPrice: number;
  originalPrice: number;
  modificationPercentage: number;
  loading: boolean;
  currentOrders: number;
}

interface UseModifiedPriceProps {
  product: Product;
  selectedOptions?: Record<string, string>;
}

export function useModifiedPrice({ product, selectedOptions = {} }: UseModifiedPriceProps): UseModifiedPriceResult {
  const { currentOrders, loading } = useOrderStats(product.id);
  
  const result = useMemo(() => {
    // Get variant price if available
    const variantKey = product.variants ? getVariantKey(product.variants, selectedOptions) : null;
    
    // Check if we have valid selected options and if the variant price exists
    const hasVariantPrice = 
      variantKey && 
      product.variantPrices && 
      variantKey in product.variantPrices;
    
    // Use variant price if it exists, otherwise use base price
    const basePrice = hasVariantPrice ? product.variantPrices![variantKey] : product.price;
    
    const modifiedPrice = calculateModifiedPrice({
      basePrice,
      currentOrders,
      minOrders: product.minimumOrderQuantity,
      maxStock: product.stock,
      modifierBefore: product.priceModifierBeforeMin ?? null,
      modifierAfter: product.priceModifierAfterMin ?? null
    });

    const modificationPercentage = calculatePriceModificationPercentage(modifiedPrice, basePrice);

    return {
      modifiedPrice,
      originalPrice: basePrice,
      modificationPercentage,
      loading,
      currentOrders
    };
  }, [product, selectedOptions, currentOrders, loading]);

  return result;
} 