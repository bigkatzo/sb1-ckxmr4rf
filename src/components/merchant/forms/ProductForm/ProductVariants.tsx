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
  const pricingToken = watch('pricingToken') || 'SOL';
  const variants = watch('variants') || [];
  const variantPrices = watch('variantPrices') || {};
  
  // Add effect to listen for pricingToken changes
  useEffect(() => {
    // This will re-render the component when pricingToken changes
    console.log(`Pricing token changed to: ${pricingToken}`);
  }, [pricingToken]);
  
  const handleVariantsChange = (updatedVariants: ProductVariant[], updatedPrices: VariantPricing) => {
    setValue('variants', updatedVariants);
    setValue('variantPrices', updatedPrices);
  };

  return (
    <VariantsSection
      variants={variants}
      onChange={handleVariantsChange}
      initialPrices={variantPrices}
      basePrice={basePrice}
    />
  );
}