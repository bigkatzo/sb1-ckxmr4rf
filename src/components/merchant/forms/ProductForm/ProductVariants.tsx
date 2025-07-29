import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { VariantsSection } from '../variants/VariantsSection';
import type { ProductVariant, VariantPricing } from '../../../../types/variants';

interface ProductVariantsProps {
  initialVariants?: ProductVariant[];
  initialPrices?: VariantPricing;
}

export function ProductVariants({ initialVariants = [], initialPrices = {} }: ProductVariantsProps) {
  const { register, watch, setValue } = useFormContext();

  // Register the variant-related fields with react-hook-form
  useEffect(() => {
    register('variants');
    register('variantPrices');
    
    // Initialize variants and prices
    if (initialVariants.length > 0) {
      setValue('variants', initialVariants);
    }
    
    if (Object.keys(initialPrices).length > 0) {
      setValue('variantPrices', initialPrices);
    }
  }, [initialVariants, initialPrices, register, setValue]);
  
  const basePrice = watch('price') || 0;
  const variants = watch('variants') || [];
  const variantPrices = watch('variantPrices') || {};
  
  const handleVariantsChange = (updatedVariants: ProductVariant[], updatedPrices: VariantPricing) => {
    setValue('variants', updatedVariants);
    setValue('variantPrices', updatedPrices);
  };

  // Filter out customization variants for display (they're auto-managed)
  const userVariants = variants.filter((variant: ProductVariant) => 
    variant.name !== 'Image Customization' && variant.name !== 'Text Customization'
  );

  // Get customization variants for info display
  const customizationVariants = variants.filter((variant: ProductVariant) => 
    variant.name === 'Image Customization' || variant.name === 'Text Customization'
  );

  return (
    <div className="space-y-4">
      {/* Show info about auto-generated customization variants */}
      {customizationVariants.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
          <p className="text-sm font-medium text-blue-300 mb-1">Auto-generated Customization Variants:</p>
          <div className="space-y-1">
            {customizationVariants.map((variant: ProductVariant) => (
              <p key={variant.id} className="text-xs text-blue-400">
                • {variant.name}: {variant.options[0]?.value || 'Yes'}
              </p>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            These variants are automatically managed based on your customization settings above.
          </p>
        </div>
      )}
      
      {/* Regular variants section */}
      <VariantsSection
        variants={userVariants}
        onChange={(updatedUserVariants, updatedPrices) => {
          // Combine user variants with customization variants
          const allVariants = [...updatedUserVariants, ...customizationVariants];
          handleVariantsChange(allVariants, updatedPrices);
        }}
        initialPrices={variantPrices}
        basePrice={basePrice}
      />
    </div>
  );
}