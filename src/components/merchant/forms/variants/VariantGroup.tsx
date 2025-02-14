import React from 'react';
import { Plus, X } from 'lucide-react';
import { VariantOption } from './VariantOption';
import type { ProductVariant, ProductVariantOption } from '../../../../types/variants';

interface VariantGroupProps {
  variant: ProductVariant;
  onUpdate: (variant: ProductVariant) => void;
  onRemove: () => void;
}

export function VariantGroup({ variant, onUpdate, onRemove }: VariantGroupProps) {
  const addOption = () => {
    const newOption: ProductVariantOption = {
      id: crypto.randomUUID(),
      value: ''
    };
    onUpdate({
      ...variant,
      options: [...variant.options, newOption]
    });
  };

  const updateOption = (updatedOption: ProductVariantOption) => {
    onUpdate({
      ...variant,
      options: variant.options.map(opt => 
        opt.id === updatedOption.id ? updatedOption : opt
      )
    });
  };

  const removeOption = (optionId: string) => {
    onUpdate({
      ...variant,
      options: variant.options.filter(opt => opt.id !== optionId)
    });
  };

  return (
    <div className="space-y-4 p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={variant.name}
          onChange={(e) => onUpdate({ ...variant, name: e.target.value })}
          placeholder="Variant name (e.g., Size, Color)"
          className="flex-1 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="button"
          onClick={onRemove}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Remove variant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {variant.options.map((option) => (
          <VariantOption
            key={option.id}
            option={option}
            onUpdate={updateOption}
            onRemove={() => removeOption(option.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addOption}
        className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
      >
        <Plus className="h-4 w-4" />
        <span>Add Option</span>
      </button>
    </div>
  );
}