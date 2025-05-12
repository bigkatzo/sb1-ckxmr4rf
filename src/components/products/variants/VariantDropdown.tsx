import type { ProductVariant } from '../../../types/variants';

interface VariantDropdownProps {
  variant: ProductVariant;
  selectedValue: string;
  onChange: (value: string) => void;
}

export function VariantDropdown({ variant, selectedValue, onChange }: VariantDropdownProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-200">
        {variant.name}
      </label>
      <select
        value={selectedValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
      >
        <option value="">Select {variant.name}</option>
        {variant.options.map((option) => (
          <option key={option.id} value={option.value}>
            {option.value}
          </option>
        ))}
      </select>
    </div>
  );
}