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
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(initialData?.images || []);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>(initialData?.variants || []);
  const [variantPrices, setVariantPrices] = useState<VariantPricing>(initialData?.variantPrices || {});

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Add images to form data
    images.forEach((file, index) => {
      formData.append(`image${index}`, file);
    });

    // Add current images if editing
    if (initialData?.images) {
      formData.append('currentImages', JSON.stringify(existingImages));
      formData.append('removedImages', JSON.stringify(removedImages));
    }

    // Add variant data
    formData.append('variants', JSON.stringify(variants));
    formData.append('variantPrices', JSON.stringify(variantPrices));

    onSubmit(formData);
  };

  const handleRemoveExistingImage = (index: number) => {
    const imageUrl = existingImages[index];
    setRemovedImages([...removedImages, imageUrl]);
    setExistingImages(existingImages.filter((_, i) => i !== index));
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
        existingImages={existingImages}
        onRemoveExisting={handleRemoveExistingImage}
      />

      <ProductBasicInfo 
        categories={categories}
        initialData={initialData}
      />

      <ProductVariants
        variants={variants}
        variantPrices={variantPrices}
        basePrice={initialData?.price || 0}
        onChange={(newVariants: ProductVariant[], newPrices: VariantPricing) => {
          setVariants(newVariants);
          setVariantPrices(newPrices);
        }}
      />
    </ModalForm>
  );
}