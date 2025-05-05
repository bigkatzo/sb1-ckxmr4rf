import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ModalForm } from '../../../ui/Modal/ModalForm';
import { ProductBasicInfo } from './ProductBasicInfo';
import { ProductImages, ProductImagesContext } from './ProductImages';
import { ProductVariants } from './ProductVariants';
import { productSchema, ProductFormValues } from './schema';
import type { Category } from '../../../../types/index';
import type { Product } from '../../../../types/variants';
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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  
  // Store image files directly in component state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  
  // Initialize default values for the form using useMemo to prevent recreation on each render
  const defaultValues = useMemo<ProductFormValues>(() => ({
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
    // CRITICAL FIX: Ensure notes is properly initialized with valid structure
    notes: {
      shipping: initialData?.notes?.shipping || '',
      quality: initialData?.notes?.quality || '',
      returns: initialData?.notes?.returns || ''
    },
    freeNotes: initialData?.freeNotes || '',
    variants: initialData?.variants || [],
    variantPrices: initialData?.variantPrices || {},
    imageFiles: [],
    existingImages: initialData?.images || [],
    removedImages: []
  }), [initialData]);
  
  // Set up react-hook-form with zod validation
  const methods = useForm({
    resolver: zodResolver(productSchema),
    defaultValues,
    mode: 'onChange'
  });
  
  // Initialize form with initialData ONLY ONCE
  useEffect(() => {
    // Only run this effect once per initialData change
    if (initialData && !initializedRef.current) {
      // Create a properly structured notes object that preserves existing values
      const notesForReset = {
        shipping: initialData?.notes?.shipping ?? '',
        quality: initialData?.notes?.quality ?? '',
        returns: initialData?.notes?.returns ?? ''
      };
      
      // Reset form with initialData and properly structured notes
      methods.reset({
        ...defaultValues,
        notes: notesForReset,
        freeNotes: initialData?.freeNotes ?? ''
      });
      
      initializedRef.current = true;
    }
    
    // Reset the initialized flag when initialData changes
    return () => {
      initializedRef.current = false;
    };
  }, [initialData, methods]);

  // Create a submit handler that processes the form data
  const processSubmit = async (data: any) => {
    // Prevent multiple submissions
    if (loading || uploading) return;
    
    setLoading(true);
    setError(null);

    try {
      console.log("Form submission data:", data);
      const formData = new FormData();

      // Add all form state data
      Object.entries(data).forEach(([key, value]) => {
        const val = value as any; // Cast to any to handle all possible types
        
        if (val !== null && val !== undefined && 
            key !== 'variants' && 
            key !== 'variantPrices' && 
            key !== 'imageFiles' && 
            key !== 'existingImages' && 
            key !== 'removedImages' &&
            key !== 'notes') {
          formData.append(key, val.toString());
        }
      });

      // Process notes properly - ensure we're adding them individually as form fields
      if (data.notes) {
        // Add each note field individually to prevent nested object serialization issues
        formData.append('notes.shipping', data.notes.shipping || '');
        formData.append('notes.quality', data.notes.quality || '');
        formData.append('notes.returns', data.notes.returns || '');
      } else {
        // Ensure notes fields are present even if notes object is null/undefined
        formData.append('notes.shipping', '');
        formData.append('notes.quality', '');
        formData.append('notes.returns', '');
      }

      // Make sure freeNotes is included (it can be an empty string)
      formData.append('freeNotes', data.freeNotes || '');

      // DIRECT ACCESS TO IMAGE FILES: Use our component state directly
      console.log("Image files from direct state:", imageFiles.length, "files");
      
      if (imageFiles.length > 0) {
        setUploading(true);
        
        imageFiles.forEach((file, index) => {
          console.log(`Adding image${index} to form data:`, file.name, file.type, file.size);
          formData.append(`image${index}`, file);
        });
      } else {
        console.log('No image files to upload');
      }

      // Add current images if editing
      if (initialData?.images) {
        formData.append('currentImages', JSON.stringify(data.existingImages || []));
        formData.append('removedImages', JSON.stringify(data.removedImages || []));
      } else {
        // Ensure these fields are always included, even for new products
        formData.append('currentImages', JSON.stringify([]));
        formData.append('removedImages', JSON.stringify([]));
      }

      // Add variant data
      formData.append('variants', JSON.stringify(data.variants || []));
      formData.append('variantPrices', JSON.stringify(data.variantPrices || {}));

      // DEBUG: Verify final FormData contents
      console.log("FormData keys:", Array.from(formData.keys()));
      
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

  // Provide the context value for ProductImages
  const imagesContextValue = useMemo(() => ({
    imageFiles,
    setImageFiles
  }), [imageFiles]);

  // Get the current visibility value, ensuring it's a boolean
  const isVisible = methods.watch('visible') === true;

  return (
    <FormProvider {...methods}>
      <ProductImagesContext.Provider value={imagesContextValue}>
        <ModalForm
          isOpen={true}
          onClose={onClose}
          onSubmit={methods.handleSubmit(processSubmit)}
          title={initialData ? 'Edit Product' : 'New Product'}
          submitLabel={initialData ? 'Update Product' : 'Create Product'}
          className="sm:min-w-[600px] sm:max-w-2xl"
          isLoading={loading || uploading || isLoading}
          error={error}
          submitButton={
            <button
              type="submit"
              disabled={loading || uploading || isLoading}
              className="bg-primary hover:bg-primary/80 px-6 py-2 rounded-lg transition-colors disabled:opacity-50 text-white flex items-center gap-2"
            >
              {(loading || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
              {initialData ? 'Update Product' : 'Create Product'}
            </button>
          }
        >
          <div className="space-y-6">
            <div className="flex justify-end items-center gap-2">
              <span className="text-sm text-gray-400">Visible</span>
              <Toggle 
                {...methods.register('visible')}
                checked={isVisible}
                onCheckedChange={(checked: boolean) => methods.setValue('visible', checked)}
              />
            </div>
            
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-6">
                  <ProductBasicInfo categories={categories} />
                </div>
                
                <div className="lg:col-span-2 space-y-6">
                  <ProductImages />
                  <ProductVariants />
                </div>
              </div>
            </div>
          </div>
        </ModalForm>
      </ProductImagesContext.Provider>
    </FormProvider>
  );
} 