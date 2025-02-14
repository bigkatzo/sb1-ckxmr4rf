import React, { useState } from 'react';
import { ModalForm } from '../../../ui/Modal/ModalForm';
import { ProductBasicInfo } from './ProductBasicInfo';
import { ProductImages } from './ProductImages';
import { ProductVariants } from './ProductVariants';
import type { Product, Category } from '../../../../types';
import type { ProductVariant, VariantPricing } from '../../../../types/variants';

export interface ProductFormProps {
  categories: Category[];
  initialData?: Product;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
}

export function ProductForm({ categories, initialData, onClose, onSubmit }: ProductFormProps) {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>(initialData?.images || []);
  const [variants, setVariants] = useState<ProductVariant[]>(initialData?.variants || []);
  const [variantPrices, setVariantPrices] = useState<VariantPricing>(initialData?.variantPrices || {});
  const [basePrice, setBasePrice] = useState<number>(initialData?.price || 0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Add images to form data
    images.forEach((file, index) => {
      formData.append(`image${index}`, file);
    });

    // Add current images if editing
    if (initialData?.images) {
      formData.append('currentImages', JSON.stringify(previews));
    }

    // Add variant data
    formData.append('variants', JSON.stringify(variants));
    formData.append('variantPrices', JSON.stringify(variantPrices));

    // Update base price from form data
    const newBasePrice = parseFloat(formData.get('price') as string) || 0;
    if (newBasePrice !== basePrice) {
      setBasePrice(newBasePrice);
    }

    onSubmit(formData);
  };

  const handleBasicInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.name === 'price') {
      setBasePrice(parseFloat(e.target.value) || 0);
    }
  };

  return (
    <ModalForm
      isOpen={true}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={initialData ? 'Edit Product' : 'New Product'}
      submitLabel={initialData ? 'Update Product' : 'Create Product'}
      className="sm:min-w-[600px] sm:max-w-2xl"
    >
      <ProductImages
        images={images}
        previews={previews}
        setImages={setImages}
        setPreviews={setPreviews}
      />

      <ProductBasicInfo 
        categories={categories}
        initialData={initialData}
        onChange={handleBasicInfoChange}
      />

      <ProductVariants
        variants={variants}
        variantPrices={variantPrices}
        basePrice={basePrice}
        onChange={(newVariants, newPrices) => {
          setVariants(newVariants);
          setVariantPrices(newPrices);
        }}
      />
    </ModalForm>
  );
}