import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { Loader2, X } from 'lucide-react';
import { ProductBasicInfo } from './ProductBasicInfo';
import { ProductImages } from './ProductImages';
import { ProductVariants } from './ProductVariants';
import { FormSkeleton } from '../../../ui/Skeleton';
import type { Category } from '../../../../types/index';
import type { Product, ProductVariant, VariantPricing } from '../../../../types/variants';
import { Toggle } from '../../../ui/Toggle';

interface ProductFormData {
  name: string;
  description: string;
  price: number;
  stock: number | null;
  categoryId: string;
  sku: string;
  minimumOrderQuantity: number;
  priceModifierBeforeMin: number | null;
  priceModifierAfterMin: number | null;
  visible: boolean;
  notes?: Record<string, string>;
  freeNotes?: string;
}

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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(initialData?.visible === undefined ? true : initialData.visible);
  const [formData, setFormData] = useState<ProductFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price || 0,
    stock: initialData?.stock ?? 0,
    categoryId: initialData?.categoryId || '',
    sku: initialData?.sku || '',
    minimumOrderQuantity: initialData?.minimumOrderQuantity || 50,
    priceModifierBeforeMin: initialData?.priceModifierBeforeMin ?? null,
    priceModifierAfterMin: initialData?.priceModifierAfterMin ?? null,
    visible: initialData?.visible === undefined ? true : initialData.visible
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (loading || uploading) return;
    
    setLoading(true);
    setError(null);

    try {
      const data = new FormData(e.currentTarget);
      
      console.log('ProductForm - Preparing form data with notes:');
      console.log('formData.notes:', formData.notes);
      console.log('formData.freeNotes:', formData.freeNotes);

      // Add basic product info
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && key !== 'visible' && key !== 'notes' && key !== 'freeNotes') {
          data.append(key, value.toString());
        }
      });
      
      // Add visibility state
      data.append('visible', visible.toString());

      // Add notes directly with proper format
      if (formData.notes) {
        if (formData.notes.shipping) {
          data.append('notes.shipping', formData.notes.shipping);
        }
        if (formData.notes.quality) {
          data.append('notes.quality', formData.notes.quality);
        }
        if (formData.notes.returns) {
          data.append('notes.returns', formData.notes.returns);
        }
      }

      // Add free notes directly
      if (formData.freeNotes) {
        data.append('freeNotes', formData.freeNotes);
      }

      // Add images to form data
      if (images.length > 0) {
        setUploading(true);
      }
      
      images.forEach((file, index) => {
        data.append(`image${index}`, file);
      });

      // Add current images if editing
      if (initialData?.images) {
        data.append('currentImages', JSON.stringify(existingImages));
        data.append('removedImages', JSON.stringify(removedImages));
      }

      // Add variant data
      data.append('variants', JSON.stringify(variants));
      data.append('variantPrices', JSON.stringify(variantPrices));

      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error('Error submitting product form:', error);
      setError(error instanceof Error ? error.message : 'Failed to save product. Please try again.');
    } finally {
      setLoading(false);
      setUploading(false);
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
            <div className="sticky top-0 flex-none bg-gray-900 z-10 flex justify-between items-center p-4 sm:p-6 border-b border-gray-800">
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
            <div className="flex-1 overflow-y-auto min-h-0">
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
                    onChange={(data) => {
                      setFormData(prev => ({
                        ...prev,
                        ...data
                      }));
                    }}
                  />

                  <div>
                    <label className="block text-sm font-medium text-white mb-1">
                      Product Visibility
                    </label>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Toggle
                          checked={visible}
                          onCheckedChange={(newValue) => {
                            setVisible(newValue);
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
                    basePrice={formData.price}
                    onChange={(newVariants: ProductVariant[], newPrices: VariantPricing) => {
                      setVariants(newVariants);
                      setVariantPrices(newPrices);
                    }}
                  />
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex-none bg-gray-900 border-t border-gray-800 p-4 sm:p-6">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading || uploading}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  form="product-form"
                  type="submit"
                  disabled={loading || uploading || isLoading}
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors disabled:opacity-50 text-white flex items-center gap-2"
                >
                  {(loading || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Saving...' : 
                   uploading ? 'Uploading...' : 
                   initialData ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}