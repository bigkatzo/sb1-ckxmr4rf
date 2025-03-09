import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import { ProductBasicInfo } from './ProductBasicInfo';
import { ProductImages } from './ProductImages';
import { ProductVariants } from './ProductVariants';
import { FormSkeleton } from '../../../ui/Skeleton';
import type { Product, Category } from '../../../../types';
import type { ProductVariant, VariantPricing } from '../../../../types/variants';

export interface ProductFormProps {
  categories: Category[];
  initialData?: Product;
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  isLoading?: boolean;
}

export function ProductForm({ categories, initialData, onClose, onSubmit, isLoading }: ProductFormProps) {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(initialData?.images || []);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>(initialData?.variants || []);
  const [variantPrices, setVariantPrices] = useState<VariantPricing>(initialData?.variantPrices || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
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

      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting product form:', error);
      setError(error instanceof Error ? error.message : 'Failed to save product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveExistingImage = (index: number) => {
    const imageUrl = existingImages[index];
    setRemovedImages([...removedImages, imageUrl]);
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      className="fixed inset-0 z-50"
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-0 sm:p-4">
          <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] bg-gray-900 sm:rounded-xl shadow-xl sm:max-w-2xl flex flex-col">
            {/* Header */}
            <div className="flex-none bg-gray-900 z-10 flex justify-between items-center p-4 sm:p-6 border-b border-gray-800">
              <Dialog.Title className="text-lg sm:text-xl font-semibold text-white">
                {initialData ? 'Edit Product' : 'New Product'}
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <FormSkeleton />
              ) : (
                <form 
                  id="product-form"
                  onSubmit={handleSubmit} 
                  className="space-y-6 p-4 sm:p-6"
                >
                  {error && (
                    <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

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
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="flex-none bg-gray-900 border-t border-gray-800 p-4 sm:p-6">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  form="product-form"
                  type="submit"
                  disabled={loading || isLoading}
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors disabled:opacity-50 text-white"
                >
                  {loading ? 'Saving...' : initialData ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}