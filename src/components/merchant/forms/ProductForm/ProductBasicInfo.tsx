import React, { useState } from 'react';

interface ProductBasicInfoProps {
  categories: Array<{
    id: string;
    name: string;
  }>;
  initialData?: {
    name?: string;
    description?: string;
    price?: number;
    stock?: number | null;
    categoryId?: string;
    sku?: string;
    minimumOrderQuantity?: number;
  };
  onChange: (data: Partial<{
    name: string;
    description: string;
    price: number;
    stock: number | null;
    categoryId: string;
    sku: string;
    minimumOrderQuantity: number;
  }>) => void;
}

export function ProductBasicInfo({ categories, initialData, onChange }: ProductBasicInfoProps) {
  const [isUnlimitedStock, setIsUnlimitedStock] = useState(initialData?.stock === null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onChange({
      [name]: value
    } as any); // Using type assertion since we know the field names match
  };

  const handleStockChange = (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLSelectElement>, isUnlimited?: boolean) => {
    if (isUnlimited !== undefined) {
      setIsUnlimitedStock(isUnlimited);
      onChange({
        stock: isUnlimited ? null : 0
      });
    } else {
      const value = parseInt(e.target.value);
      onChange({
        stock: isNaN(value) ? 0 : value
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
          Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={initialData?.name}
          onChange={handleInputChange}
          required
          className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white"
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
          onChange={handleInputChange}
          rows={3}
          className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white"
          placeholder="Enter product description"
        />
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium text-white mb-1">
          Price *
        </label>
        <input
          type="number"
          id="price"
          name="price"
          defaultValue={initialData?.price}
          onChange={handleInputChange}
          required
          min="0"
          step="0.01"
          className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white"
          placeholder="Enter price"
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
            defaultValue={initialData?.stock === null ? '' : initialData?.stock}
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
        <label htmlFor="minimumOrderQuantity" className="block text-sm font-medium text-white mb-1">
          Minimum Order Quantity *
        </label>
        <input
          type="number"
          id="minimumOrderQuantity"
          name="minimumOrderQuantity"
          defaultValue={initialData?.minimumOrderQuantity}
          onChange={handleInputChange}
          required
          min="1"
          className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white"
          placeholder="Enter minimum order quantity"
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-white mb-1">
          Category *
        </label>
        <select
          id="category"
          name="categoryId"
          defaultValue={initialData?.categoryId}
          onChange={handleInputChange}
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
    </div>
  );
}