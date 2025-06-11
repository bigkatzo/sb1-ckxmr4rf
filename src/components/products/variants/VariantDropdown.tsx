import type { ProductVariant } from '../../../types/variants';

interface VariantDropdownProps {
  variant: ProductVariant;
  selectedValue: string;
  onChange: (value: string) => void;
}

export function VariantDropdown({ variant, selectedValue, onChange }: VariantDropdownProps) {
  return (
    <div className="space-y-2">
      <label 
        className="block text-sm font-medium"
        style={{ color: 'var(--color-text)' }}
      >
        {variant.name}
      </label>
      <select
        value={selectedValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2"
        style={{
          backgroundColor: 'var(--color-input-background)',
          color: 'var(--color-text)',
          borderColor: 'var(--color-input-background)',
          '--focus-ring-color': 'var(--color-secondary)'
        } as React.CSSProperties}
        onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px var(--color-secondary)`}
        onBlur={(e) => e.target.style.boxShadow = 'none'}
      >
        <option value="">Select {variant.name}</option>
        {variant.options.map((option) => (
          <option key={option.id} value={option.value}>
            {option.label || option.value}
          </option>
        ))}
      </select>
    </div>
  );
}