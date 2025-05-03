import React from 'react';
import { X } from 'lucide-react';
import type { ProductVariantOption } from '../../../../types/variants';

interface VariantOptionProps {
  option: ProductVariantOption;
  onUpdate: (option: ProductVariantOption) => void;
  onRemove: () => void;
}

export function VariantOption({ option, onUpdate, onRemove }: VariantOptionProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={option.value}
        onChange={(e) => onUpdate({ ...option, value: e.target.value })}
        placeholder="Option value (e.g., Small, Red)"
        className="flex-1 bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button
        type="button"
        onClick={onRemove}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        title="Remove option"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}