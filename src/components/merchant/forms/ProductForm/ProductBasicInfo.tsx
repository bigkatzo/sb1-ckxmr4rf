import { useFormContext } from 'react-hook-form';
import type { ProductFormValues } from './schema';
import { PricingCurveEditor } from './PricingCurveEditor';

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
  const { register, formState: { errors } } = useFormContext<ProductFormValues>();
  
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-white">
          Product Name
        </label>
        <input
          type="text"
          id="name"
          {...register('name')}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {errors.name && (
          <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-white">
          Product Description
        </label>
        <textarea
          id="description"
          rows={4}
          {...register('description')}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
        ></textarea>
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
        <label htmlFor="sku" className="block text-sm font-medium text-white">
          Product SKU (Optional)
        </label>
        <input
          type="text"
          id="sku"
          {...register('sku')}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {errors.sku && (
          <p className="text-red-400 text-xs mt-1">{errors.sku.message}</p>
        )}
      </div>

      <PricingCurveEditor />

      <div className="border-t border-gray-800 pt-4">
        <h3 className="text-sm font-medium text-white mb-4">Product Notes (Optional)</h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="notes.shipping" className="block text-sm font-medium text-white">
              Shipping Notes
            </label>
            <textarea
              id="notes.shipping"
              rows={2}
              {...register('notes.shipping')}
              className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Shipping information, delivery timeframes, etc."
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
              placeholder="e.g. Material quality, care instructions, etc."
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
              placeholder="e.g. Return policy, exchanges, etc."
            ></textarea>
          </div>
          
          <div>
            <label htmlFor="freeNotes" className="block text-sm font-medium text-white">
              Additional Notes
            </label>
            <textarea
              id="freeNotes"
              rows={3}
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