import { useState, useEffect, useRef, useMemo } from 'react';
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
      console.log('ProductForm - Initial data received DETAILED:', { 
        initialData,
        notesObject: initialData.notes,
        notesIsUndefined: initialData.notes === undefined,
        notesIsNull: initialData.notes === null,
        notesType: typeof initialData.notes,
        notesKeys: initialData.notes ? Object.keys(initialData.notes) : 'no keys',
        freeNotes: initialData.freeNotes,
        freeNotesType: typeof initialData.freeNotes,
        freeNotesIsEmpty: initialData.freeNotes === ''
      });
    }
  }, [initialData]);
  
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
  
  // Log the constructed default values in more detail
  useEffect(() => {
    console.log('ProductForm - Default values with notes DETAILED:', {
      notesFromInitialData: initialData?.notes,
      notesFromInitialDataType: typeof initialData?.notes,
      notesShippingFromInitial: initialData?.notes?.shipping,
      notesQualityFromInitial: initialData?.notes?.quality,
      notesReturnsFromInitial: initialData?.notes?.returns,
      freeNotesFromInitialData: initialData?.freeNotes,
      freeNotesFromInitialDataType: typeof initialData?.freeNotes,
      notesInDefaultValues: defaultValues.notes,
      notesShippingInDefault: defaultValues.notes.shipping,
      notesQualityInDefault: defaultValues.notes.quality,
      notesReturnsInDefault: defaultValues.notes.returns,
      freeNotesInDefaultValues: defaultValues.freeNotes
    });
  }, [initialData, defaultValues]);
  
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
      // Log before reset
      console.log('ProductForm - DEBUGGING NOTES VALUES RECEIVED:', {
        initialData,
        notesObject: initialData.notes,
        shipping: initialData?.notes?.shipping,
        quality: initialData?.notes?.quality,
        returns: initialData?.notes?.returns
      });
    
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
      
      console.log('ProductForm - AFTER form reset with values:', {
        notesObject: methods.getValues('notes'),
        notesShipping: methods.getValues('notes.shipping'),
        notesQuality: methods.getValues('notes.quality'),
        notesReturns: methods.getValues('notes.returns'),
        freeNotes: methods.getValues('freeNotes')
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
      const formData = new FormData();

      // Log the form data before submission with more details
      console.log('Form data before submission:', {
        notesObject: data.notes,
        notesShipping: data.notes?.shipping,
        notesQuality: data.notes?.quality,
        notesReturns: data.notes?.returns,
        freeNotes: data.freeNotes
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

      // Process notes properly - ensure we're adding them individually as form fields
      if (data.notes) {
        // Add each note field individually to prevent nested object serialization issues
        formData.append('notes.shipping', data.notes.shipping || '');
        formData.append('notes.quality', data.notes.quality || '');
        formData.append('notes.returns', data.notes.returns || '');
        
        console.log('Added notes to form data:', {
          'notes.shipping': data.notes.shipping || '',
          'notes.quality': data.notes.quality || '',
          'notes.returns': data.notes.returns || ''
        });
      } else {
        // Ensure notes fields are present even if notes object is null/undefined
        formData.append('notes.shipping', '');
        formData.append('notes.quality', '');
        formData.append('notes.returns', '');
        console.log('Added empty notes to form data as notes object was null/undefined');
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