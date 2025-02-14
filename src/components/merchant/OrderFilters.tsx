import React from 'react';
import { Search } from 'lucide-react';

interface OrderFiltersProps {
  collections: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  selectedCollection: string;
  selectedProduct: string;
  searchQuery: string;
  onCollectionChange: (id: string) => void;
  onProductChange: (id: string) => void;
  onSearchChange: (query: string) => void;
}

export function OrderFilters({
  collections,
  products,
  selectedCollection,
  selectedProduct,
  searchQuery,
  onCollectionChange,
  onProductChange,
  onSearchChange
}: OrderFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* Search Box */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search orders by ID, product, shipping details..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-gray-800 rounded-lg pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:w-[320px]">
        {/* Collection Filter */}
        <select
          value={selectedCollection}
          onChange={(e) => onCollectionChange(e.target.value)}
          className="w-full sm:w-1/2 bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All Collections</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>

        {/* Product Filter */}
        <select
          value={selectedProduct}
          onChange={(e) => onProductChange(e.target.value)}
          className="w-full sm:w-1/2 bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All Products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}