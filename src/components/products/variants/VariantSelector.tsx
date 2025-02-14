import React from 'react';
import type { ProductVariant } from '../../../types/variants';

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedOptions: Record<string, string>;
  onChange: (variantId: string, value: string) => void;
}

export function VariantSelector({ variants, selectedOptions, onChange }: VariantSelectorProps) {
  return (
    <div className="space-y-4">
      {variants.map((variant) => (
        <div key={variant.id} className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">
            {variant.name}
          </label>
          <div className="flex flex-wrap gap-2">
            {variant.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(variant.id, option.value)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${selectedOptions[variant.id] === option.value
                    ? 'bg-purple-600 text-white ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }
                `}
              >
                {option.value}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}