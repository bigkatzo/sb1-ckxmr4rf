import { useFormContext } from 'react-hook-form';
import type { ProductFormValues } from './schema';
import { PricingCurveEditor } from './PricingCurveEditor';
import { RichTextEditor } from '../../../ui/RichTextEditor';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ProductBasicInfoProps {
  categories: {
    id: string;
    name: string;
    type: string;
  }[];
}

// Inline the CategorySelect component to avoid import issues
function InlineCategory({ categories }: { categories: ProductBasicInfoProps['categories'] }) {
  const { register } = useFormContext<ProductFormValues>();

  return (
    <select
      id="categoryId"
      {...register('categoryId')}
      className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <option value="">Select a category</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}

export function ProductBasicInfo({ categories }: ProductBasicInfoProps) {
  const { register, watch, setValue, formState: { errors } } = useFormContext<ProductFormValues>();
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  const currentDescription = watch('description') || '';
  const isCustomizable = watch('isCustomizable') || false;
  
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-white">
          Product Name
        </label>
        <input
          type="text"
          id="name"
          {...register('name')}
          placeholder="Enter product name"
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {errors.name && (
          <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-1">
          Product Description
        </label>
        <RichTextEditor
          content={currentDescription}
          onChange={(content) => setValue('description', content, { shouldDirty: true })}
          placeholder="Enter product description"
          className="mt-1"
        />
        {errors.description && (
          <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="categoryId" className="block text-sm font-medium text-white">
          Product Category
        </label>
        <InlineCategory categories={categories} />
        {errors.categoryId && (
          <p className="text-red-400 text-xs mt-1">{errors.categoryId.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="sku" className="block text-sm font-medium text-white flex items-center gap-2">
          Product SKU
          <span className="text-xs text-gray-400">(Auto-generated, cannot be edited)</span>
        </label>
        <input
          type="text"
          id="sku"
          {...register('sku')}
          readOnly={true}
          disabled={true}
          placeholder="Auto-generated on creation"
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white opacity-70 cursor-not-allowed"
        />
        {errors.sku && (
          <p className="text-red-400 text-xs mt-1">{errors.sku.message}</p>
        )}
      </div>

      {/* Customization Options Section */}
      <div className="border border-gray-800 rounded-lg p-4 bg-gray-900">
        <div className="flex items-center space-x-3 mb-3">
          <input
            type="checkbox"
            id="isCustomizable"
            {...register('isCustomizable')}
            className="h-4 w-4 text-primary bg-gray-800 border-gray-600 rounded focus:ring-primary focus:ring-2"
          />
          <label htmlFor="isCustomizable" className="text-sm font-medium text-white">
            This product is customizable
          </label>
        </div>
        
        {isCustomizable && (
          <div className="ml-7 space-y-3">
            <p className="text-sm text-gray-400 mb-3">Select customization options:</p>
            
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="customization.image"
                {...register('customization.image')}
                className="h-4 w-4 text-primary bg-gray-800 border-gray-600 rounded focus:ring-primary focus:ring-2"
              />
              <label htmlFor="customization.image" className="text-sm text-white">
                Image customization
              </label>
            </div>
            
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="customization.text"
                {...register('customization.text')}
                className="h-4 w-4 text-primary bg-gray-800 border-gray-600 rounded focus:ring-primary focus:ring-2"
              />
              <label htmlFor="customization.text" className="text-sm text-white">
                Text customization
              </label>
            </div>
            
            {errors.customization && (
              <p className="text-red-400 text-xs mt-1">{errors.customization.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Advanced Product Options Section */}
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          className="w-full px-4 py-3 bg-gray-800 text-left flex justify-between items-center text-sm font-medium text-white"
        >
          Advanced product options
          {showAdvancedOptions ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
        
        {showAdvancedOptions && (
          <div className="p-4 space-y-3 bg-gray-900">
            <div>
              <label htmlFor="blankCode" className="block text-sm font-medium text-white">
                Blank Code
              </label>
              <input
                type="text"
                id="blankCode"
                {...register('blankCode')}
                className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter blank code"
              />
            </div>
            
            <div>
              <label htmlFor="technique" className="block text-sm font-medium text-white">
                Technique
              </label>
              <input
                type="text"
                id="technique"
                {...register('technique')}
                className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter manufacturing technique"
              />
            </div>
            
            <div>
              <label htmlFor="noteForSupplier" className="block text-sm font-medium text-white">
                Note for Supplier
              </label>
              <textarea
                id="noteForSupplier"
                rows={2}
                {...register('noteForSupplier')}
                className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Special instructions for the supplier"
              ></textarea>
            </div>
          </div>
        )}
      </div>

      <PricingCurveEditor />

      <div className="border-t border-gray-800 pt-4 mt-4">
        <h3 className="text-sm font-medium text-white mb-2">Product Notes (Optional)</h3>
        
        <div className="space-y-3">
          <div>
            <label htmlFor="notes.shipping" className="block text-sm font-medium text-white">
              Shipping Notes
            </label>
            <textarea
              id="notes.shipping"
              rows={2}
              {...register('notes.shipping')}
              className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Free Shipping Worldwide included (15-20 days*)"
            ></textarea>
          </div>
          
          <div>
            <label htmlFor="notes.quality" className="block text-sm font-medium text-white">
              Quality & Care
            </label>
            <textarea
              id="notes.quality"
              rows={2}
              {...register('notes.quality')}
              className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Quality is guaranteed. If there is a print error or visible quality issue, we'll replace or refund it."
            ></textarea>
          </div>
          
          <div>
            <label htmlFor="notes.returns" className="block text-sm font-medium text-white">
              Returns Policy
            </label>
            <textarea
              id="notes.returns"
              rows={2}
              {...register('notes.returns')}
              className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Because the products are made to order, we do not accept general returns or sizing-related returns."
            ></textarea>
          </div>
          
          <div>
            <label htmlFor="freeNotes" className="block text-sm font-medium text-white">
              Additional Notes
            </label>
            <textarea
              id="freeNotes"
              rows={2}
              {...register('freeNotes')}
              className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Any additional information about the product"
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  );
}