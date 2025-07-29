import { useMemo } from 'react';
import type { ProductVariant, VariantPricing } from '../../../../types/variants';

interface VariantPricingProps {
  variants: ProductVariant[];
  prices: VariantPricing;
  basePrice: number;
  onPriceChange: (key: string, price: number) => void;
}

export function VariantPricing({ variants, prices, basePrice, onPriceChange }: VariantPricingProps) {
  // Separate customization variants from regular variants
  const { customizationVariants, regularVariants } = useMemo(() => {
    const customization = variants.filter(v => 
      v.name === 'Image Customization' || v.name === 'Text Customization'
    );
    const regular = variants.filter(v => 
      v.name !== 'Image Customization' && v.name !== 'Text Customization'
    );
    return { customizationVariants: customization, regularVariants: regular };
  }, [variants]);

  // Generate unique combinations of variants
  const combinations = useMemo(() => {
    const result: Array<{
      key: string;
      labels: string[];
      isCustomization: boolean;
    }> = [];
    
    if (variants.length === 0) return result;
    
    const generate = (current: string[], currentLabels: string[], index: number) => {
      if (index === variants.length) {
        // Create a deterministic key
        const keyParts = current.map((value, i) => `${variants[i].id}:${value}`).sort();
        const key = keyParts.join('|');
        
        // Check if this combination includes any customization variants
        const isCustomization = currentLabels.some(label => 
          label.includes('Image Customization') || label.includes('Text Customization')
        );
        
        result.push({
          key,
          labels: [...currentLabels],
          isCustomization
        });
        return;
      }
      
      variants[index].options.forEach(option => {
        current[index] = option.value;
        currentLabels[index] = `${variants[index].name}: ${option.label || option.value}`;
        generate(current, currentLabels, index + 1);
      });
    };
    
    generate(new Array(variants.length), new Array(variants.length), 0);
    
    return result;
  }, [variants]);

  // Group combinations by type
  const { customizationCombinations, regularCombinations } = useMemo(() => {
    const customization = combinations.filter(c => c.isCustomization);
    const regular = combinations.filter(c => !c.isCustomization);
    return { customizationCombinations: customization, regularCombinations: regular };
  }, [combinations]);

  // Apply base price to all variants
  const applyBasePriceToAll = () => {
    combinations.forEach(({ key }) => {
      onPriceChange(key, basePrice);
    });
  };

  // Apply base price to specific section
  const applyBasePriceToSection = (sectionCombinations: typeof combinations) => {
    sectionCombinations.forEach(({ key }) => {
      onPriceChange(key, basePrice);
    });
  };

  if (!variants.length) return null;

  // Debug logging to help troubleshoot
  console.log('VariantPricing - variants:', variants);
  console.log('VariantPricing - combinations:', combinations);
  console.log('VariantPricing - customizationCombinations:', customizationCombinations);
  console.log('VariantPricing - regularCombinations:', regularCombinations);

  const renderPricingTable = (
    combos: typeof combinations, 
    title: string, 
    showSectionButton: boolean = false,
    bgColor: string = "",
    description?: string
  ) => (
    <div className={`space-y-3 p-4 rounded-lg ${bgColor}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300">{title}</h4>
        {showSectionButton && (
          <button
            type="button"
            onClick={() => applyBasePriceToSection(combos)}
            className="text-xs text-secondary hover:text-secondary-light border border-secondary rounded px-2 py-1 transition-colors"
          >
            Apply Base Price
          </button>
        )}
      </div>
      
      {description && (
        <p className="text-xs text-gray-400">{description}</p>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="py-2 text-left font-medium text-gray-400 w-2/3">Variant</th>
              <th className="py-2 text-right font-medium text-gray-400 w-1/3">Price (SOL)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {combos.map(({ key, labels }) => (
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
                      className="w-32 bg-gray-800 rounded px-3 py-1 text-right focus:outline-none focus:ring-2 focus:ring-primary"
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Variant Pricing</h3>
        <button
          type="button"
          onClick={applyBasePriceToAll}
          className="text-sm text-secondary hover:text-secondary-light border border-secondary rounded-lg px-3 py-1 transition-colors"
        >
          Apply Base Price to All
        </button>
      </div>

      {/* Customization Variants Section */}
      {customizationCombinations.length > 0 && (
        renderPricingTable(
          customizationCombinations, 
          "Customization Options", 
          true,
          "bg-blue-900/10 border border-blue-800",
          "Set additional prices for customization services. These are added to the base product price."
        )
      )}

      {/* Regular Variants Section */}
      {regularCombinations.length > 0 && (
        renderPricingTable(
          regularCombinations, 
          regularVariants.length > 0 ? "Product Variants" : "Base Product", 
          regularCombinations.length > 1,
          "bg-gray-900/50 border border-gray-700"
        )
      )}

      {/* Show message when only customization variants exist */}
      {customizationCombinations.length > 0 && regularCombinations.length === 0 && (
        <div className="text-center py-4 text-gray-400 text-sm">
          Add product variants (like size, color, etc.) to see additional pricing options.
        </div>
      )}
    </div>
  );
}