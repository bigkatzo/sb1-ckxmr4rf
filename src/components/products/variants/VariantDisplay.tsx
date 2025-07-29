import React from 'react';
import { VariantDropdown } from './VariantDropdown';
import type { ProductVariant } from '../../../types/variants';

interface VariantDisplayProps {
  variants: ProductVariant[];
  selectedOptions: Record<string, string>;
  onChange: (variantId: string, value: string) => void;
}

const customizationFields = ['Image', 'Text']

export function VariantDisplay({ variants, selectedOptions, onChange }: VariantDisplayProps) {
  if (!variants?.length) return null;

  return (
    <div className="space-y-4">
      {variants.map((variant) => (
        !customizationFields.includes(variant.name) &&
          <VariantDropdown
            key={variant.id}
            variant={variant}
            selectedValue={selectedOptions[variant.id] || ''}
            onChange={(value) => onChange(variant.id, value)}
          />
      ))}
    </div>
  );
}