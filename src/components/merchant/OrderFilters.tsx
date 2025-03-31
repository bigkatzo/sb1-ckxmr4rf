import { Search } from 'lucide-react';
import { useState } from 'react';
import type { OrderStatus } from '../../types/orders';

interface OrderFiltersProps {
  collections: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  selectedCollections: string[];
  selectedProducts: string[];
  selectedStatuses: OrderStatus[];
  searchQuery: string;
  onCollectionChange: (ids: string[]) => void;
  onProductChange: (ids: string[]) => void;
  onStatusChange: (statuses: OrderStatus[]) => void;
  onSearchChange: (query: string) => void;
}

export function OrderFilters({
  collections,
  products,
  selectedCollections,
  selectedProducts,
  selectedStatuses,
  searchQuery,
  onCollectionChange,
  onProductChange,
  onStatusChange,
  onSearchChange
}: OrderFiltersProps) {
  const [openDropdown, setOpenDropdown] = useState<'status' | 'collection' | 'product' | null>(null);

  const handleStatusChange = (status: OrderStatus) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter(s => s !== status));
    } else {
      onStatusChange([...selectedStatuses, status]);
    }
  };

  const handleCollectionChange = (collectionId: string) => {
    if (selectedCollections.includes(collectionId)) {
      onCollectionChange(selectedCollections.filter(id => id !== collectionId));
    } else {
      onCollectionChange([...selectedCollections, collectionId]);
    }
  };

  const handleProductChange = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      onProductChange(selectedProducts.filter(id => id !== productId));
    } else {
      onProductChange([...selectedProducts, productId]);
    }
  };

  const statuses: OrderStatus[] = ['confirmed', 'shipped', 'delivered', 'cancelled', 'draft', 'pending_payment'];

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* Search Box */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by order #, SKU, product, collection, contact, wallet, transaction..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-gray-800 rounded-lg pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:w-[480px]">
        {/* Collection Filter */}
        <div className="w-full sm:w-1/3 relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'collection' ? null : 'collection')}
            className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
          >
            {selectedCollections.length === 0 ? 'Collection' : `Collection (${selectedCollections.length})`}
          </button>
          {openDropdown === 'collection' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
              {collections.map((collection) => (
                <label
                  key={collection.id}
                  className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(collection.id)}
                    onChange={() => handleCollectionChange(collection.id)}
                    className="mr-2 rounded text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-xs sm:text-sm">{collection.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Product Filter */}
        <div className="w-full sm:w-1/3 relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'product' ? null : 'product')}
            className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
          >
            {selectedProducts.length === 0 ? 'Product' : `Product (${selectedProducts.length})`}
          </button>
          {openDropdown === 'product' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
              {products.map((product) => (
                <label
                  key={product.id}
                  className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => handleProductChange(product.id)}
                    className="mr-2 rounded text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-xs sm:text-sm">{product.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-1/3 relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
            className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
          >
            {selectedStatuses.length === 0 ? 'Status' : `Status (${selectedStatuses.length})`}
          </button>
          {openDropdown === 'status' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
              {statuses.map((status) => (
                <label
                  key={status}
                  className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => handleStatusChange(status)}
                    className="mr-2 rounded text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-xs sm:text-sm">
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}