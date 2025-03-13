import React, { useState } from 'react';
import { ModalForm } from '../../../ui/Modal/ModalForm';
import { ProductBasicInfo } from './ProductBasicInfo';
import { ProductImages } from './ProductImages';
import { ProductVariants } from './ProductVariants';
import type { Category } from '../../../../types/index';
import type { Product, ProductVariant, VariantPricing } from '../../../../types/variants';
import { Toggle } from '../../../ui/Toggle';

export interface ProductFormProps {
  categories: Category[];
  initialData?: Product;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
}

export function ProductForm({ categories, initialData, onClose, onSubmit }: ProductFormProps) {
  const [formState, setFormState] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price || 0,
    stock: initialData?.stock ?? null,
    categoryId: initialData?.categoryId || '',
    sku: initialData?.sku || '',
    minimumOrderQuantity: initialData?.minimumOrderQuantity || 50,
    visible: initialData?.visible ?? true,
    priceModifierBeforeMin: initialData?.priceModifierBeforeMin ?? null,
    priceModifierAfterMin: initialData?.priceModifierAfterMin ?? null,
  });
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(initialData?.images || []);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>(initialData?.variants || []);
  const [variantPrices, setVariantPrices] = useState<VariantPricing>(initialData?.variantPrices || {});

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();

    // Add all form state data
    Object.entries(formState).forEach(([key, value]) => {
      if (value !== null) {
        formData.append(key, value.toString());
      }
    });

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

  const handleBasicInfoChange = (data: Partial<{
    name: string;
    description: string;
    price: number;
    stock: number | null;
    categoryId: string;
    sku: string;
    minimumOrderQuantity: number;
    visible: boolean;
  }>) => {
    setFormState(prev => ({
      ...prev,
      ...data
    }));
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
        setExistingImages={setExistingImages}
        onRemoveExisting={handleRemoveExistingImage}
      />

      <ProductBasicInfo 
        categories={categories}
        initialData={formState}
        onChange={handleBasicInfoChange}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-white">
              Product Visibility
            </label>
            <p className="text-xs text-gray-400">
              When disabled, this product will be hidden from the storefront
            </p>
          </div>
          <Toggle
            checked={formState.visible}
            onCheckedChange={(newValue: boolean) => {
              handleBasicInfoChange({ visible: newValue });
            }}
            size="md"
          />
        </div>
      </div>

      <ProductVariants
        variants={variants}
        variantPrices={variantPrices}
        basePrice={formState.price}
        onChange={(newVariants, newPrices) => {
          setVariants(newVariants);
          setVariantPrices(newPrices);
        }}
      />
    </ModalForm>
  );
}