import { useMemo } from 'react';
import type { ProductVariant, VariantPricing } from '../../../../types/variants';

interface VariantPricingProps {
  variants: ProductVariant[];
  prices: VariantPricing;
  basePrice: number;
  onPriceChange: (key: string, price: number) => void;
}

export function VariantPricing({ variants, prices, basePrice, onPriceChange }: VariantPricingProps) {
  // Generate unique combinations of variants
  const combinations = useMemo(() => {
    const result: Array<{
      key: string;
      labels: string[];
    }> = [];
    
    const generate = (current: string[], currentLabels: string[], index: number) => {
      if (index === variants.length) {
        // Create a deterministic key by sorting variant IDs
        const key = current
          .map((value, i) => `${variants[i].id}:${value}`)
          .sort()
          .join('|');
        
        // Only add if this combination is unique
        if (!result.some(c => c.key === key)) {
          result.push({
            key,
            labels: [...currentLabels]
          });
        }
        return;
      }
      
      variants[index].options.forEach(option => {
        current[index] = option.value;
        currentLabels[index] = `${variants[index].name}: ${option.value}`;
        generate(current, currentLabels, index + 1);
      });
    };
    
    if (variants.length > 0) {
      generate(new Array(variants.length), new Array(variants.length), 0);
    }
    
    return result;
  }, [variants]);

  // Apply base price to all variants
  const applyBasePriceToAll = () => {
    combinations.forEach(({ key }) => {
      onPriceChange(key, basePrice);
    });
  };

  if (!variants.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Variant Pricing</h3>
        <button
          type="button"
          onClick={applyBasePriceToAll}
          className="text-sm text-purple-400 hover:text-purple-300 border border-purple-700 rounded-lg px-3 py-1 transition-colors"
        >
          Apply Base Price to All
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="py-2 text-left font-medium text-gray-400 w-2/3">Variant</th>
              <th className="py-2 text-right font-medium text-gray-400 w-1/3">Price (SOL)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {combinations.map(({ key, labels }) => (
              <tr key={key}>
                <td className="py-2 pr-4">{labels.join(', ')}</td>
                <td className="py-2">
                  <div className="flex justify-end">
                    <input
                      type="number"
                      min="0"
                      step="0.000000001"
                      value={prices[key] ?? basePrice}
                      onChange={e => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0) {
                          onPriceChange(key, value);
                        }
                      }}
                      placeholder={basePrice.toString()}
                      className="w-32 bg-gray-800 rounded px-3 py-1 text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}