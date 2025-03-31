import { Search } from 'lucide-react';
import type { OrderStatus } from '../../types/orders';

interface OrderFiltersProps {
  collections: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  selectedCollection: string;
  selectedProduct: string;
  selectedStatuses: OrderStatus[];
  searchQuery: string;
  onCollectionChange: (id: string) => void;
  onProductChange: (id: string) => void;
  onStatusChange: (statuses: OrderStatus[]) => void;
  onSearchChange: (query: string) => void;
}

export function OrderFilters({
  collections,
  products,
  selectedCollection,
  selectedProduct,
  selectedStatuses,
  searchQuery,
  onCollectionChange,
  onProductChange,
  onStatusChange,
  onSearchChange
}: OrderFiltersProps) {
  const handleStatusChange = (status: OrderStatus) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter(s => s !== status));
    } else {
      onStatusChange([...selectedStatuses, status]);
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
        <select
          value={selectedCollection}
          onChange={(e) => onCollectionChange(e.target.value)}
          className="w-full sm:w-1/3 bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
          className="w-full sm:w-1/3 bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All Products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <div className="w-full sm:w-1/3">
          <div className="relative">
            <div className="bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer">
              <div className="flex flex-wrap gap-1">
                {selectedStatuses.length === 0 ? (
                  <span className="text-gray-400">All Statuses</span>
                ) : (
                  selectedStatuses.map((status) => (
                    <span
                      key={status}
                      className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full text-xs"
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                    </span>
                  ))
                )}
              </div>
            </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}