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

  // Effect to handle automatic variant creation/removal
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
      }
    } else if (imageVariantIndex !== -1) {
      // Remove image customization variant and its prices
      const removedVariant = updatedVariants[imageVariantIndex];
      updatedVariants.splice(imageVariantIndex, 1);
      
      // Clean up prices for this variant
      const updatedPrices = { ...variantPrices };
      Object.keys(updatedPrices).forEach(key => {
        if (key.includes(removedVariant.id)) {
          delete updatedPrices[key];
        }
      });
      setValue('variantPrices', updatedPrices);
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
      }
    } else if (textVariantIndex !== -1) {
      // Remove text customization variant and its prices
      const removedVariant = updatedVariants[textVariantIndex];
      updatedVariants.splice(textVariantIndex, 1);
      
      // Clean up prices for this variant
      const updatedPrices = { ...variantPrices };
      Object.keys(updatedPrices).forEach(key => {
        if (key.includes(removedVariant.id)) {
          delete updatedPrices[key];
        }
      });
      setValue('variantPrices', updatedPrices);
    }

    // Update variants if changes were made
    if (JSON.stringify(updatedVariants) !== JSON.stringify(variants)) {
      setValue('variants', updatedVariants);
    }
  }, [isCustomizable, customizationImage, customizationText, variants, variantPrices, setValue]);

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
          {errors.customization && (
              <p className="text-red-400 text-xs mt-1">{typeof errors.customization?.message === 'string' ? errors.customization.message : ''}</p>
          )}
        </div>
        
        {(isCustomizable === 'optional' || isCustomizable === 'mandatory') && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Select customization options:</p>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
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
              
              <div className="flex items-center space-x-2">
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
            </div>
            
            {(customizationImage || customizationText) && (
              <div className="mt-3 p-3 bg-blue-900/20 border border-blue-700 rounded-md">
                <p className="text-xs text-blue-400 mb-1">Auto-generated variants:</p>
                {customizationImage && (
                  <p className="text-xs text-green-400">• Image Customization variant added</p>
                )}
                {customizationText && (
                  <p className="text-xs text-green-400">• Text Customization variant added</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Set prices for these customization options in the Variant Pricing section below.
                </p>
              </div>
            )}
            
            {errors.isCustomizable && (
            <p className="text-red-400 text-xs mt-1">
              {typeof errors.isCustomizable?.message === 'string' ? errors.isCustomizable.message : ''}
            </p>
          )}
          </div>
        )}
      </div>
    </div>
  );
}