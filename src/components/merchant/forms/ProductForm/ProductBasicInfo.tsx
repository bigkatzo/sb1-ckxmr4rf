import { useFormContext } from 'react-hook-form';
import type { ProductFormValues } from './schema';

export interface ProductBasicInfoProps {
  categories: {
    id: string;
    name: string;
  }[];
}

export function ProductBasicInfo({ categories }: ProductBasicInfoProps) {
  const { register, setValue, formState: { errors }, getValues } = useFormContext<ProductFormValues>();
  
  // Default notes for placeholders
  const defaultNotes = {
    shipping: "Free Shipping Worldwide included (15-20 days*)",
    quality: "Quality is guaranteed. If there's a print error or visible quality issue, we'll replace or refund it.",
    returns: "Because the products are made to order, we do not accept general returns or sizing-related returns."
  };
  
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="sku" className="block text-sm font-medium text-white">
          SKU
        </label>
        <input
          type="text"
          id="sku"
          {...register('sku')}
          readOnly
          disabled
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed focus:outline-none"
          placeholder="Auto-generated"
        />
        <p className="mt-1 text-sm text-gray-400">
          SKU is auto-generated and cannot be changed
        </p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-white">
          Product Name
        </label>
        <input
          type="text"
          id="name"
          {...register('name')}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {errors.name && (
          <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-white">
          Description
        </label>
        <textarea
          id="description"
          {...register('description')}
          rows={4}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {errors.description && (
          <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-white">
          Category
        </label>
        <select
          id="categoryId"
          {...register('categoryId')}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Select a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p className="text-red-400 text-xs mt-1">{errors.categoryId.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium text-white">
          Base Price (SOL)
        </label>
        <input
          type="number"
          id="price"
          min="0"
          step="0.01"
          {...register('price', {
            valueAsNumber: true,
            onChange: (e) => {
              // Ensure only numeric values are accepted
              const value = parseFloat(e.target.value);
              if (!isNaN(value)) {
                setValue('price', value);
              }
            }
          })}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {errors.price && (
          <p className="text-red-400 text-xs mt-1">{errors.price.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="priceModifierBeforeMin" className="block text-sm font-medium text-white">
          Price Modifier Before Minimum (-1 to 1)
        </label>
        <input
          type="number"
          id="priceModifierBeforeMin"
          min="-1"
          max="1"
          step="0.01"
          {...register('priceModifierBeforeMin', {
            setValueAs: (value) => value === '' ? null : parseFloat(value),
          })}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="e.g. -0.2 for 20% discount"
        />
        <p className="mt-1 text-sm text-gray-400">
          Leave empty for no modification. Use negative values for discounts (e.g. -0.2 for 20% off)
        </p>
        {errors.priceModifierBeforeMin && (
          <p className="text-red-400 text-xs mt-1">{errors.priceModifierBeforeMin.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="priceModifierAfterMin" className="block text-sm font-medium text-white">
          Price Modifier After Minimum (0 or greater)
        </label>
        <input
          type="number"
          id="priceModifierAfterMin"
          min="0"
          step="0.01"
          {...register('priceModifierAfterMin', {
            setValueAs: (value) => value === '' ? null : parseFloat(value),
          })}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="e.g. 2 for up to 200% increase"
        />
        <p className="mt-1 text-sm text-gray-400">
          Leave empty for no modification. Use positive values (e.g. 2 for up to 200% increase)
        </p>
        {errors.priceModifierAfterMin && (
          <p className="text-red-400 text-xs mt-1">{errors.priceModifierAfterMin.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="stock" className="block text-sm font-medium text-white">
          Stock
        </label>
        <input
          type="number"
          id="stock"
          min="0"
          {...register('stock', {
            setValueAs: (value) => value === '' ? null : parseInt(value),
          })}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Leave empty for unlimited stock"
        />
        {errors.stock && (
          <p className="text-red-400 text-xs mt-1">{errors.stock.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="minimumOrderQuantity" className="block text-sm font-medium text-white">
          Minimum Order Quantity
        </label>
        <input
          type="number"
          id="minimumOrderQuantity"
          min="1"
          {...register('minimumOrderQuantity', {
            valueAsNumber: true,
          })}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {errors.minimumOrderQuantity && (
          <p className="text-red-400 text-xs mt-1">{errors.minimumOrderQuantity.message}</p>
        )}
      </div>

      {/* Product Notes Section */}
      <div className="border-t border-gray-800 pt-4">
        <h3 className="text-sm font-medium text-white mb-4">Product Notes (Optional)</h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="notes.shipping" className="block text-sm font-medium text-white">
              Shipping Notes
            </label>
            <textarea
              id="notes.shipping"
              {...register('notes.shipping')}
              rows={2}
              className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder={defaultNotes.shipping}
            />
          </div>
          
          <div>
            <label htmlFor="notes.quality" className="block text-sm font-medium text-white">
              Quality Notes
            </label>
            <textarea
              id="notes.quality"
              {...register('notes.quality')}
              rows={2}
              className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder={defaultNotes.quality}
            />
          </div>
          
          <div>
            <label htmlFor="notes.returns" className="block text-sm font-medium text-white">
              Returns Notes
            </label>
            <textarea
              id="notes.returns"
              {...register('notes.returns')}
              rows={2}
              className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder={defaultNotes.returns}
            />
          </div>
          
          <div>
            <label htmlFor="freeNotes" className="block text-sm font-medium text-white">
              Additional Notes
            </label>
            <textarea
              id="freeNotes"
              {...register('freeNotes')}
              rows={3}
              className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Any other information about the product..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}