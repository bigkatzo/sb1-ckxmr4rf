import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import type { ProductVariant } from '../../../../types/variants';

export function CustomizationOptions() {
  const { register, watch, setValue, formState: { errors } } = useFormContext();
  
  const isCustomizable = watch('isCustomizable');
  const customizationImage = watch('customization.image');
  const customizationText = watch('customization.text');
  const variants = watch('variants') || [];
  const variantPrices = watch('variantPrices') || {};
  const basePrice = watch('price') || 0;

  // Effect to handle automatic variant creation/removal and pricing
  useEffect(() => {
    if (isCustomizable === 'no') {
      // Remove customization variants when not customizable
      const filteredVariants = variants.filter((variant: ProductVariant) => 
        variant.name !== 'Image Customization' && variant.name !== 'Text Customization'
      );
      setValue('variants', filteredVariants);
      setValue('customization.image', false);
      setValue('customization.text', false);
      
      // Clean up variant prices for customization variants
      const updatedPrices = { ...variantPrices };
      Object.keys(updatedPrices).forEach(key => {
        if (key.includes('Image Customization') || key.includes('Text Customization')) {
          delete updatedPrices[key];
        }
      });
      setValue('variantPrices', updatedPrices);
      return;
    }

    let updatedVariants = [...variants];
    let updatedPrices = { ...variantPrices };
    
    // Handle Image Customization variant
    const imageVariantIndex = updatedVariants.findIndex((v: ProductVariant) => v.name === 'Image Customization');
    
    if (customizationImage) {
      if (imageVariantIndex === -1) {
        // Add image customization variant
        const imageVariant: ProductVariant = {
          id: crypto.randomUUID(),
          name: 'Image Customization',
          options: [
            {
              id: crypto.randomUUID(),
              value: 'Yes',
              label: 'Image Customization',
              // isDefault: true
            }
          ]
        };
        updatedVariants.push(imageVariant);
        
        // Set default price for image customization
        const imageKey = `${imageVariant.id}:Yes`;
        if (!updatedPrices[imageKey]) {
          updatedPrices[imageKey] = basePrice;
        }
      }
    } else if (imageVariantIndex !== -1) {
      // Remove image customization variant and its prices
      const removedVariant = updatedVariants[imageVariantIndex];
      updatedVariants.splice(imageVariantIndex, 1);
      
      // Clean up prices for this variant
      Object.keys(updatedPrices).forEach(key => {
        if (key.includes(removedVariant.id)) {
          delete updatedPrices[key];
        }
      });
    }

    // Handle Text Customization variant
    const textVariantIndex = updatedVariants.findIndex((v: ProductVariant) => v.name === 'Text Customization');
    
    if (customizationText) {
      if (textVariantIndex === -1) {
        // Add text customization variant
        const textVariant: ProductVariant = {
          id: crypto.randomUUID(),
          name: 'Text Customization',
          options: [
            {
              id: crypto.randomUUID(),
              value: 'Yes',
              label: 'Text Customization',
              // isDefault: true
            }
          ]
        };
        updatedVariants.push(textVariant);
        
        // Set default price for text customization
        const textKey = `${textVariant.id}:Yes`;
        if (!updatedPrices[textKey]) {
          updatedPrices[textKey] = basePrice;
        }
      }
    } else if (textVariantIndex !== -1) {
      // Remove text customization variant and its prices
      const removedVariant = updatedVariants[textVariantIndex];
      updatedVariants.splice(textVariantIndex, 1);
      
      // Clean up prices for this variant
      Object.keys(updatedPrices).forEach(key => {
        if (key.includes(removedVariant.id)) {
          delete updatedPrices[key];
        }
      });
    }

    // Update variants and prices if changes were made
    if (JSON.stringify(updatedVariants) !== JSON.stringify(variants)) {
      setValue('variants', updatedVariants);
    }
    if (JSON.stringify(updatedPrices) !== JSON.stringify(variantPrices)) {
      setValue('variantPrices', updatedPrices);
    }
  }, [isCustomizable, customizationImage, customizationText, variants, variantPrices, basePrice, setValue]);

  // Helper function to get customization variant price
  const getCustomizationPrice = (variantName: string) => {
    const variant = variants.find((v: ProductVariant) => v.name === variantName);
    if (!variant) return basePrice;
    
    const priceKey = `${variant.id}:Yes`;
    return variantPrices[priceKey] || basePrice;
  };

  // Helper function to update customization price
  const updateCustomizationPrice = (variantName: string, price: number) => {
    const variant = variants.find((v: ProductVariant) => v.name === variantName);
    if (!variant) return;
    
    const priceKey = `${variant.id}:Yes`;
    const updatedPrices = { ...variantPrices, [priceKey]: price };
    setValue('variantPrices', updatedPrices);
  };

  return (
    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900">
      <div className="space-y-3">
        <div>
          <label htmlFor="isCustomizable" className="block text-sm font-medium text-white mb-2">
            Product Customization
          </label>
          <select
            id="isCustomizable"
            {...register('isCustomizable')}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="no">No</option>
            <option value="optional">Optional</option>
            <option value="mandatory">Yes (Mandatory)</option>
          </select>
          {errors.isCustomizable && (
            <p className="text-red-400 text-xs mt-1">
              {typeof errors.isCustomizable?.message === 'string' ? errors.isCustomizable.message : ''}
            </p>
          )}
        </div>
        
        {(isCustomizable === 'optional' || isCustomizable === 'mandatory') && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Select customization options:</p>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="customization.image"
                    {...register('customization.image')}
                    className="h-4 w-4 text-primary bg-gray-800 border-gray-600 rounded focus:ring-primary focus:ring-2"
                  />
                  <label htmlFor="customization.image" className="text-sm text-white">
                    Image customization
                  </label>
                </div>
                
                {customizationImage && (
                  <div className="flex-1 ml-4">
                    <label className="block text-xs text-gray-400 mb-1">
                      Additional price for image customization
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={getCustomizationPrice('Image Customization')}
                        onChange={(e) => updateCustomizationPrice('Image Customization', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="customization.text"
                    {...register('customization.text')}
                    className="h-4 w-4 text-primary bg-gray-800 border-gray-600 rounded focus:ring-primary focus:ring-2"
                  />
                  <label htmlFor="customization.text" className="text-sm text-white">
                    Text customization
                  </label>
                </div>
                
                {customizationText && (
                  <div className="flex-1 ml-4">
                    <label className="block text-xs text-gray-400 mb-1">
                      Additional price for text customization
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={getCustomizationPrice('Text Customization')}
                        onChange={(e) => updateCustomizationPrice('Text Customization', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {(customizationImage || customizationText) && (
              <div className="mt-3 p-3 bg-gray-800 rounded-md">
                <p className="text-xs text-gray-400 mb-2">Auto-generated variants with pricing:</p>
                {customizationImage && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-green-400">• Image Customization variant</span>
                    <span className="text-gray-300">${getCustomizationPrice('Image Customization')}</span>
                  </div>
                )}
                {customizationText && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-green-400">• Text Customization variant</span>
                    <span className="text-gray-300">${getCustomizationPrice('Text Customization')}</span>
                  </div>
                )}
              </div>
            )}
            
            {errors.customization && (
              <p className="text-red-400 text-xs mt-1">{typeof errors.customization?.message === 'string' ? errors.customization.message : ''}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}