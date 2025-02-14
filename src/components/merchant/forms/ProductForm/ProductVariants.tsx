import React from 'react';
import { VariantsSection } from '../variants/VariantsSection';
import type { ProductVariant, VariantPricing } from '../../../../types/variants';

interface ProductVariantsProps {
  variants: ProductVariant[];
  variantPrices: VariantPricing;
  basePrice: number;
  onChange: (variants: ProductVariant[], prices: VariantPricing) => void;
}

export function ProductVariants({ variants, variantPrices, basePrice, onChange }: ProductVariantsProps) {
  return (
    <VariantsSection
      variants={variants}
      onChange={onChange}
      initialPrices={variantPrices}
      basePrice={basePrice}
    />
  );
}