import { useMemo } from 'react';
import { useOrderStats } from './useOrderStats';
import { calculateModifiedPrice, calculatePriceModificationPercentage } from '../utils/price';
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
    const variantKey = Object.values(selectedOptions).join(':');
    const variantPrice = selectedOptions && Object.keys(selectedOptions).length > 0 && product.variantPrices?.[variantKey] 
      ? product.variantPrices[variantKey] 
      : 0;
    
    // Use variant price if available, otherwise use base price
    const basePrice = variantPrice > 0 ? variantPrice : product.price;
    
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