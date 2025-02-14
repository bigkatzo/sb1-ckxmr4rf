import type { ProductVariant, VariantPricing, VariantStock } from '../types/variants';

export function getVariantKey(variants: ProductVariant[], selectedOptions: Record<string, string>): string | null {
  // Check if all variants are selected
  const allSelected = variants.every(v => selectedOptions[v.id]);
  if (!allSelected) return null;

  // Create variant key by sorting variant IDs and concatenating selected values
  return variants
    .map(v => `${v.id}:${selectedOptions[v.id]}`)
    .sort()
    .join('|');
}

export function getVariantPrice(
  basePrice: number,
  variantPrices: VariantPricing | undefined,
  variantKey: string | null
): number {
  if (!variantKey || !variantPrices) return basePrice;
  return variantPrices[variantKey] ?? basePrice;
}

export function getVariantStock(
  baseStock: number,
  variantStock: VariantStock | undefined,
  variantKey: string | null
): number {
  if (!variantKey || !variantStock) return baseStock;
  return variantStock[variantKey] ?? baseStock;
}

export function generateVariantCombinations(variants: ProductVariant[]): string[] {
  const combinations: string[] = [];
  
  const generate = (current: string[], index: number) => {
    if (index === variants.length) {
      combinations.push(current.join('|'));
      return;
    }
    
    variants[index].options.forEach(option => {
      current[index] = `${variants[index].id}:${option.value}`;
      generate(current, index + 1);
    });
  };

  if (variants.length > 0) {
    generate(new Array(variants.length), 0);
  }

  return combinations;
}