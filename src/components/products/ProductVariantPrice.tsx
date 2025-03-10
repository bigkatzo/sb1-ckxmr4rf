import React from 'react';
import { getVariantKey, getVariantPrice } from '../../utils/variant-helpers';
import type { Product } from '../../types/variants';

interface ProductVariantPriceProps {
  product: Product;
  selectedOptions: Record<string, string>;
}

export function ProductVariantPrice({ product, selectedOptions }: ProductVariantPriceProps) {
  const variantKey = product.variants?.length 
    ? getVariantKey(product.variants, selectedOptions)
    : null;

  const price = getVariantPrice(product.price, product.variantPrices, variantKey);

  return (
    <div className="flex items-center justify-between">
      <span className="text-2xl font-bold text-white">
        {price} SOL
      </span>
      <span className="text-sm text-gray-400">
        {variantKey === null && product.variants?.length
          ? 'Select options to check availability'
          : `${product.stock === null ? 'Unlimited' : product.stock} available`
        }
      </span>
    </div>
  );
}