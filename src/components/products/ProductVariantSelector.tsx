import type { Product } from '../../types/variants';

interface ProductVariantSelectorProps {
  product: Product;
  selectedOptions: Record<string, string>;
  onChange: (variantId: string, optionId: string) => void;
}

export function ProductVariantSelector({
  product,
  selectedOptions,
  onChange
}: ProductVariantSelectorProps) {
  if (!product.variants || product.variants.length === 0) {
    return null;
  }

  // Calculate price difference for a variant option
  const getVariantPriceDifference = (variantId: string, optionId: string): number => {
    if (!product.variantPrices || Object.keys(product.variantPrices).length === 0) {
      return 0;
    }

    // Create a key to look up this specific option's price
    const currentSelections = { ...selectedOptions };
    currentSelections[variantId] = optionId;
    
    // Create a variant key
    const variantKey = product.variants?.map(v => {
      if (currentSelections[v.id]) {
        return `${v.id}:${currentSelections[v.id]}`;
      }
      return null;
    }).filter(Boolean).join(',');
    
    // If we have a price for this combination, calculate the difference
    if (variantKey && product.variantPrices[variantKey]) {
      return product.variantPrices[variantKey] - product.price;
    }
    
    return 0;
  };

  // Format the price according to the selected token
  const formatPrice = (price: number) => {
    const pricingToken = product.pricingToken || 'SOL';
    return price.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: pricingToken === 'USDC' ? 2 : 8 
    });
  };

  return (
    <div className="space-y-4">
      {product.variants.map((variant) => (
        <div key={variant.id} className="space-y-2">
          <label htmlFor={variant.id} className="block text-sm font-medium text-white">
            {variant.name}
          </label>
          <select
            id={variant.id}
            value={selectedOptions[variant.id] || ''}
            onChange={(e) => onChange(variant.id, e.target.value)}
            className="block w-full rounded-lg bg-gray-800 border-gray-700 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="" className="text-black">Select {variant.name}</option>
            {variant.options.map((option) => (
              <option 
                key={option.id} 
                value={option.id}
                className="text-black"
              >
                {option.value} {getVariantPriceDifference(variant.id, option.id) !== 0 && (
                  `(${getVariantPriceDifference(variant.id, option.id) > 0 ? '+' : ''}${formatPrice(getVariantPriceDifference(variant.id, option.id))} ${product.pricingToken || 'SOL'})`
                )}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
} 