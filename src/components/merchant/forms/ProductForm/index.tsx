import React, { useState } from 'react';
import { ModalForm } from '../../../ui/Modal/ModalForm';
import { ProductBasicInfo } from './ProductBasicInfo';
import { ProductImages } from './ProductImages';
import { ProductVariants } from './ProductVariants';
import type { Category } from '../../../../types/index';
import type { Product, ProductVariant, VariantPricing } from '../../../../types/variants';
import { Toggle } from '../../../ui/Toggle';
import { Loader2 } from 'lucide-react';

export interface ProductFormProps {
  categories: Category[];
  initialData?: Product;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  isLoading?: boolean;
}

export function ProductForm({ categories, initialData, onClose, onSubmit, isLoading }: ProductFormProps) {
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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (loading || uploading) return;
    
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();

      // Add all form state data
      Object.entries(formState).forEach(([key, value]) => {
        if (value !== null) {
          formData.append(key, value.toString());
        }
      });

      // Add images to form data
      if (images.length > 0) {
        setUploading(true);
      }
      
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

      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting product form:', error);
      setError(error instanceof Error ? error.message : 'Failed to save product. Please try again.');
    } finally {
      setLoading(false);
      setUploading(false);
    }
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
      isLoading={loading || uploading || isLoading}
      error={error}
      submitButton={
        <button
          type="submit"
          disabled={loading || uploading || isLoading}
          className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors disabled:opacity-50 text-white flex items-center gap-2"
        >
          {(loading || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Saving...' : 
           uploading ? 'Uploading...' : 
           initialData ? 'Update Product' : 'Create Product'}
        </button>
      }
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

      <div>
        <label className="block text-sm font-medium text-white mb-1">
          Product Visibility
        </label>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Toggle
              checked={formState.visible}
              onCheckedChange={(newValue: boolean) => {
                handleBasicInfoChange({ visible: newValue });
              }}
              size="md"
            />
            <span className="text-sm text-white">Show in storefront</span>
          </div>
          <p className="text-xs text-gray-400 ml-11">
            When disabled, this product will be hidden from the storefront
          </p>
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