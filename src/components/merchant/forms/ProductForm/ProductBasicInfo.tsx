import React from 'react';
import type { Product, Category } from '../../../../types';

interface ProductBasicInfoProps {
  categories: Category[];
  initialData?: Product;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ProductBasicInfo({ categories, initialData, onChange }: ProductBasicInfoProps) {
  return (
    <div className="space-y-4">
      {initialData?.sku && (
        <div>
          <label className="block text-sm font-medium mb-2">SKU</label>
          <input
            type="text"
            value={initialData.sku}
            disabled
            className="w-full bg-gray-800 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed"
          />
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Product Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={initialData?.name}
          required
          className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-2">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={initialData?.description}
          required
          rows={4}
          className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium mb-2">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={initialData?.categoryId}
          required
          className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Select a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="block text-sm font-medium mb-2">
            Base Price (SOL)
          </label>
          <input
            type="number"
            id="price"
            name="price"
            min="0"
            step="0.000000001"
            defaultValue={initialData?.price || 0}
            required
            onChange={onChange}
            className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium mb-2">
            Base Stock
          </label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            min="0"
            defaultValue={initialData?.stock || 0}
            required
            className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="minOrderQty" className="block text-sm font-medium mb-2">
          Minimum Order Quantity
        </label>
        <input
          type="number"
          id="minOrderQty"
          name="minOrderQty"
          min="1"
          defaultValue={initialData?.minimumOrderQuantity || 50}
          required
          className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          Minimum number of items required per order
        </p>
      </div>
    </div>
  );
}