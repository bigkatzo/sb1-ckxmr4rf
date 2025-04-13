import { useState, useEffect, useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ModalForm } from '../../../ui/Modal/ModalForm';
import { ProductBasicInfo } from './ProductBasicInfo';
import { ProductImages } from './ProductImages';
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
  
  // Log initialData for debugging
  useEffect(() => {
    if (initialData) {
      console.log('ProductForm - Initial data received:', { 
        initialData,
        notes: initialData.notes,
        freeNotes: initialData.freeNotes
      });
    }
  }, [initialData]);
  
  // Initialize default values for the form
  const defaultValues: ProductFormValues = {
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
    // Ensure notes properties are always strings
    notes: {
      shipping: initialData?.notes?.shipping || '',
      quality: initialData?.notes?.quality || '',
      returns: initialData?.notes?.returns || ''
    },
    freeNotes: initialData?.freeNotes || '',
    // Initialize the array and object fields
    variants: initialData?.variants || [],
    variantPrices: initialData?.variantPrices || {},
    imageFiles: [],
    existingImages: initialData?.images || [],
    removedImages: []
  };
  
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
      // Reset form with initialData - ensure notes and freeNotes are properly set
      methods.reset({
        ...defaultValues,
        notes: {
          shipping: initialData?.notes?.shipping || '',
          quality: initialData?.notes?.quality || '',
          returns: initialData?.notes?.returns || ''
        },
        freeNotes: initialData?.freeNotes || ''
      });
      
      console.log('ProductForm - Form initialized once with values:', {
        notes: methods.getValues('notes'),
        freeNotes: methods.getValues('freeNotes')
      });
      
      initializedRef.current = true;
    }
    
    // Reset the initialized flag when initialData changes
    return () => {
      initializedRef.current = false;
    };
  }, [initialData]);

  // Create a submit handler that processes the form data
  const processSubmit = async (data: any) => {
    // Prevent multiple submissions
    if (loading || uploading) return;
    
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();

      // Log the form data for debugging
      console.log('Form data before submission:', {
        freeNotes: data.freeNotes,
        notes: data.notes
      });

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

      // Process notes properly - ensure we're adding them as a JSON string
      if (data.notes) {
        // Create a clean notes object
        const notesObj = {
          shipping: data.notes.shipping || '',
          quality: data.notes.quality || '',
          returns: data.notes.returns || ''
        };
        
        // Add notes as properly formatted JSON
        formData.append('notes', JSON.stringify(notesObj));
        console.log('Added notes to form data:', notesObj);
      }

      // Make sure freeNotes is included (it can be an empty string)
      formData.append('freeNotes', data.freeNotes || '');
      console.log('Added freeNotes to form data:', data.freeNotes);

      // Handle image files
      const imageFiles = data.imageFiles;
      if (Array.isArray(imageFiles) && imageFiles.length > 0) {
        setUploading(true);
        imageFiles.forEach((file, index) => {
          formData.append(`image${index}`, file);
        });
      }

      // Add current images if editing
      if (initialData?.images) {
        formData.append('currentImages', JSON.stringify(data.existingImages || []));
        formData.append('removedImages', JSON.stringify(data.removedImages || []));
      }

      // Add variant data
      formData.append('variants', JSON.stringify(data.variants || []));
      formData.append('variantPrices', JSON.stringify(data.variantPrices || {}));

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

  return (
    <FormProvider {...methods}>
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
          initialExistingImages={initialData?.images}
        />

        <ProductBasicInfo 
          categories={categories}
        />

        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Product Visibility
          </label>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Toggle
                checked={methods.watch('visible') ?? false}
                onCheckedChange={(newValue: boolean) => {
                  methods.setValue('visible', newValue, { shouldDirty: true });
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
          initialVariants={initialData?.variants}
          initialPrices={initialData?.variantPrices}
        />
      </ModalForm>
    </FormProvider>
  );
}