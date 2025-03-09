import React from 'react';
import type { Product, Category } from '../../../../types';

interface ProductBasicInfoProps {
  categories: Category[];
  initialData?: Product;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ProductBasicInfo({ categories, initialData, onChange }: ProductBasicInfoProps) {
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
          required
          min="1"
          className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
        />
      </div>
    </div>
  );
}