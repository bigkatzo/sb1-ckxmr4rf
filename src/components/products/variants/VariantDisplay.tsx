// import React from 'react';
import { VariantDropdown } from './VariantDropdown';
import type { ProductVariant } from '../../../types/variants';

interface VariantDisplayProps {
  variants: ProductVariant[];
  selectedOptions: Record<string, string>;
  onChange: (variantId: string, value: string) => void;
}

const customizationFields = ['Image Customization', 'Text Customization'];

export function VariantDisplay({ variants, selectedOptions, onChange }: VariantDisplayProps) {
  if (!variants?.length) return null;

  // Filter out customization variants - these are handled by ProductCustomization component
  const regularVariants = variants.filter(variant => !customizationFields.includes(variant.name));
  
  if (regularVariants.length === 0) return null;

  return (
    <div className="space-y-4">
      {regularVariants.map((variant) => (
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