import React, { useState } from 'react';
import type { Product, Category } from '../../../../types';

interface ProductBasicInfoProps {
  categories: Category[];
  initialData?: Product;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export function ProductBasicInfo({ categories, initialData, onChange }: ProductBasicInfoProps) {
  const [isUnlimitedStock, setIsUnlimitedStock] = useState(initialData?.stock === -1);

  const handleStockChange = (e: React.ChangeEvent<HTMLInputElement>, isUnlimited?: boolean) => {
    if (onChange) {
      // Use isUnlimited parameter if provided, otherwise use state
      const useUnlimited = isUnlimited !== undefined ? isUnlimited : isUnlimitedStock;
      const value = useUnlimited ? -1 : parseInt(e.target.value) || 0;
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: value.toString(),
          name: 'stock'
        }
      };
      onChange(syntheticEvent);
    }
  };

  return (
    <div className="space-y-6">
      {initialData?.sku && (
        <div>
          <label className="block text-sm font-medium text-white mb-1">
            SKU
          </label>
          <input
            type="text"
            value={initialData.sku}
            disabled
            className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
          />
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
          Product Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={initialData?.name}
          onChange={onChange}
          required
          className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
          placeholder="Enter product name"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-white mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={initialData?.description}
          onChange={onChange}
          required
          rows={3}
          className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
          placeholder="Enter product description"
        />
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium text-white mb-1">
          Base Price (SOL) *
        </label>
        <input
          type="number"
          id="price"
          name="price"
          defaultValue={initialData?.price}
          onChange={onChange}
          required
          min="0"
          step="0.01"
          className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
          placeholder="0.00"
        />
      </div>

      <div>
        <label htmlFor="stock" className="block text-sm font-medium text-white mb-1">
          Stock *
        </label>
        <div className="space-y-2">
          <input
            type="number"
            id="stock"
            name="stock"
            defaultValue={initialData?.stock === -1 ? '' : initialData?.stock}
            onChange={(e) => handleStockChange(e)}
            required
            min="0"
            disabled={isUnlimitedStock}
            className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 disabled:opacity-50"
            placeholder="Enter stock quantity"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="unlimited-stock"
              checked={isUnlimitedStock}
              onChange={(e) => {
                setIsUnlimitedStock(e.target.checked);
                handleStockChange(e, e.target.checked);
              }}
              className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-600"
            />
            <label htmlFor="unlimited-stock" className="text-sm text-gray-300">
              Unlimited stock
            </label>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-white mb-1">
          Category *
        </label>
        <select
          id="category"
          name="category"
          defaultValue={initialData?.categoryId}
          required
          className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white"
        >
          <option value="">Select a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="minimumOrderQuantity" className="block text-sm font-medium text-white mb-1">
          Minimum Order Quantity *
        </label>
        <input
          type="number"
          id="minimumOrderQuantity"
          name="minimumOrderQuantity"
          defaultValue={initialData?.minimumOrderQuantity || 50}
          onChange={onChange}
          required
          min="1"
          className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
        />
      </div>
    </div>
  );
}