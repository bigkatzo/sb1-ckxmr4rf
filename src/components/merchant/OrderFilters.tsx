import { Search } from 'lucide-react';
import type { OrderStatus } from '../../types/orders';

interface OrderFiltersProps {
  collections: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  selectedCollection: string;
  selectedProduct: string;
  selectedStatus: OrderStatus | '';
  searchQuery: string;
  onCollectionChange: (id: string) => void;
  onProductChange: (id: string) => void;
  onStatusChange: (status: OrderStatus | '') => void;
  onSearchChange: (query: string) => void;
}

export function OrderFilters({
  collections,
  products,
  selectedCollection,
  selectedProduct,
  selectedStatus,
  searchQuery,
  onCollectionChange,
  onProductChange,
  onStatusChange,
  onSearchChange
}: OrderFiltersProps) {
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
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value as OrderStatus | '')}
          className="w-full sm:w-1/3 bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="draft">Draft</option>
          <option value="pending_payment">Pending Payment</option>
        </select>
      </div>
    </div>
  );
}