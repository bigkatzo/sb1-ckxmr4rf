import { useState } from 'react';
import React from 'react';

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
    priceModifierBeforeMin?: number | null;
    priceModifierAfterMin?: number | null;
  };
  onChange: (data: Partial<{
    name: string;
    description: string;
    price: number;
    stock: number | null;
    categoryId: string;
    sku: string;
    minimumOrderQuantity: number;
    priceModifierBeforeMin: number | null;
    priceModifierAfterMin: number | null;
  }>) => void;
}

export function ProductBasicInfo({ categories, initialData, onChange }: ProductBasicInfoProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [price, setPrice] = useState(initialData?.price || 0);
  const [stock, setStock] = useState<string>(initialData?.stock?.toString() || '');
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '');
  const [minimumOrderQuantity, setMinimumOrderQuantity] = useState(initialData?.minimumOrderQuantity || 50);
  const [priceModifierBeforeMin, setPriceModifierBeforeMin] = useState<string>(
    initialData?.priceModifierBeforeMin?.toString() || ''
  );
  const [priceModifierAfterMin, setPriceModifierAfterMin] = useState<string>(
    initialData?.priceModifierAfterMin?.toString() || ''
  );
  const [sku] = useState(initialData?.sku || '');

  // Update local state when initialData changes
  React.useEffect(() => {
    setName(initialData?.name || '');
    setDescription(initialData?.description || '');
    setPrice(initialData?.price || 0);
    setStock(initialData?.stock?.toString() || '');
    setCategoryId(initialData?.categoryId || '');
    setMinimumOrderQuantity(initialData?.minimumOrderQuantity || 50);
    setPriceModifierBeforeMin(initialData?.priceModifierBeforeMin?.toString() || '');
    setPriceModifierAfterMin(initialData?.priceModifierAfterMin?.toString() || '');
  }, [initialData]);

  const handleStockChange = (value: string) => {
    setStock(value);
    onChange({ stock: value === '' ? null : parseInt(value, 10) });
  };

  const handlePriceModifierBeforeMinChange = (value: string) => {
    setPriceModifierBeforeMin(value);
    onChange({ priceModifierBeforeMin: value === '' ? null : parseFloat(value) });
  };

  const handlePriceModifierAfterMinChange = (value: string) => {
    setPriceModifierAfterMin(value);
    onChange({ priceModifierAfterMin: value === '' ? null : parseFloat(value) });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="sku" className="block text-sm font-medium text-white">
          SKU
        </label>
        <input
          type="text"
          id="sku"
          name="sku"
          value={sku}
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
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            onChange({ name: e.target.value });
          }}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-white">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            onChange({ description: e.target.value });
          }}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium text-white">
          Category
        </label>
        <input type="hidden" name="categoryId" value={categoryId} />
        <select
          id="category"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            onChange({ categoryId: e.target.value });
          }}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
        <label htmlFor="price" className="block text-sm font-medium text-white">
          Base Price (SOL)
        </label>
        <input
          type="number"
          id="price"
          name="price"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => {
            setPrice(parseFloat(e.target.value));
            onChange({ price: parseFloat(e.target.value) });
          }}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label htmlFor="priceModifierBeforeMin" className="block text-sm font-medium text-white">
          Price Modifier Before Minimum (-1 to 1)
        </label>
        <input
          type="number"
          id="priceModifierBeforeMin"
          name="priceModifierBeforeMin"
          min="-1"
          max="1"
          step="0.01"
          value={priceModifierBeforeMin}
          onChange={(e) => handlePriceModifierBeforeMinChange(e.target.value)}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="e.g. -0.2 for 20% discount"
        />
        <p className="mt-1 text-sm text-gray-400">
          Leave empty for no modification. Use negative values for discounts (e.g. -0.2 for 20% off)
        </p>
      </div>

      <div>
        <label htmlFor="priceModifierAfterMin" className="block text-sm font-medium text-white">
          Price Modifier After Minimum (0 or greater)
        </label>
        <input
          type="number"
          id="priceModifierAfterMin"
          name="priceModifierAfterMin"
          min="0"
          step="0.01"
          value={priceModifierAfterMin}
          onChange={(e) => handlePriceModifierAfterMinChange(e.target.value)}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="e.g. 2 for up to 200% increase"
        />
        <p className="mt-1 text-sm text-gray-400">
          Leave empty for no modification. Use positive values (e.g. 2 for up to 200% increase)
        </p>
      </div>

      <div>
        <label htmlFor="stock" className="block text-sm font-medium text-white">
          Stock
        </label>
        <input
          type="number"
          id="stock"
          name="stock"
          min="0"
          value={stock}
          onChange={(e) => handleStockChange(e.target.value)}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Leave empty for unlimited stock"
        />
      </div>

      <div>
        <label htmlFor="minimumOrderQuantity" className="block text-sm font-medium text-white">
          Minimum Order Quantity
        </label>
        <input
          type="number"
          id="minimumOrderQuantity"
          name="minimumOrderQuantity"
          min="1"
          value={minimumOrderQuantity}
          onChange={(e) => {
            setMinimumOrderQuantity(parseInt(e.target.value, 10));
            onChange({ minimumOrderQuantity: parseInt(e.target.value, 10) });
          }}
          className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>
    </div>
  );
}