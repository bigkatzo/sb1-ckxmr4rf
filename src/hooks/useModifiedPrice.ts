import { useMemo } from 'react';
import { useOrderStats } from './useOrderStats';
import { calculateModifiedPrice, calculatePriceModificationPercentage } from '../utils/price';
import type { Product } from '../types';

interface UseModifiedPriceResult {
  modifiedPrice: number;
  originalPrice: number;
  modificationPercentage: number;
  loading: boolean;
  currentOrders: number;
}

export function useModifiedPrice(product: Product): UseModifiedPriceResult {
  const { currentOrders, loading } = useOrderStats(product.id);
  
  const result = useMemo(() => {
    const modifiedPrice = calculateModifiedPrice({
      basePrice: product.price,
      currentOrders,
      minOrders: product.minimumOrderQuantity,
      maxStock: product.stock,
      modifierBefore: product.priceModifierBeforeMin ?? null,
      modifierAfter: product.priceModifierAfterMin ?? null
    });

    const modificationPercentage = calculatePriceModificationPercentage(modifiedPrice, product.price);

    return {
      modifiedPrice,
      originalPrice: product.price,
      modificationPercentage,
      loading,
      currentOrders
    };
  }, [product, currentOrders, loading]);

  return result;
} 