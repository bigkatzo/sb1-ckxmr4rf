import { Search, ChevronDown, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { OrderStatus } from '../../types/orders';

interface OrderFiltersProps {
  collections: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  selectedCollections: string[];
  selectedProducts: string[];
  selectedStatuses: OrderStatus[];
  selectedPaymentMethods: string[];
  searchQuery: string;
  onCollectionChange: (ids: string[]) => void;
  onProductChange: (ids: string[]) => void;
  onStatusChange: (statuses: OrderStatus[]) => void;
  onPaymentMethodChange: (methods: string[]) => void;
  onSearchChange: (query: string) => void;
}

export function OrderFilters({
  collections,
  products,
  selectedCollections,
  selectedProducts,
  selectedStatuses,
  selectedPaymentMethods,
  searchQuery,
  onCollectionChange,
  onProductChange,
  onStatusChange,
  onPaymentMethodChange,
  onSearchChange
}: OrderFiltersProps) {
  const [openDropdown, setOpenDropdown] = useState<'status' | 'collection' | 'product' | 'payment' | null>(null);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter collections based on search term
  const filteredCollections = collections.filter(collection => 
    collection.name.toLowerCase().includes(collectionSearch.toLowerCase())
  );

  // Filter products based on search term
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(productSearch.toLowerCase())
  );

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

  const handlePaymentMethodChange = (method: string) => {
    if (selectedPaymentMethods.includes(method)) {
      onPaymentMethodChange(selectedPaymentMethods.filter(m => m !== method));
    } else {
      onPaymentMethodChange([...selectedPaymentMethods, method]);
    }
  };

  const handleSelectAllCollections = () => {
    if (selectedCollections.length === filteredCollections.length) {
      // Deselect all if all are already selected
      onCollectionChange([]);
    } else {
      // Select all filtered collections
      onCollectionChange(filteredCollections.map(c => c.id));
    }
  };

  const handleSelectAllProducts = () => {
    if (selectedProducts.length === filteredProducts.length) {
      // Deselect all if all are already selected
      onProductChange([]);
    } else {
      // Select all filtered products
      onProductChange(filteredProducts.map(p => p.id));
    }
  };

  const handleSelectAllStatuses = (statuses: OrderStatus[]) => {
    if (selectedStatuses.length === statuses.length) {
      // Deselect all if all are already selected
      onStatusChange([]);
    } else {
      // Select all statuses
      onStatusChange([...statuses]);
    }
  };

  const handleSelectAllPaymentMethods = (methods: string[]) => {
    if (selectedPaymentMethods.length === methods.length) {
      // Deselect all if all are already selected
      onPaymentMethodChange([]);
    } else {
      // Select all payment methods
      onPaymentMethodChange([...methods]);
    }
  };

  const statuses: OrderStatus[] = ['confirmed', 'shipped', 'delivered', 'cancelled', 'draft', 'pending_payment'];
  const paymentMethods = ['solana', 'stripe'];

  return (
    <div className="flex flex-col sm:flex-row gap-2" ref={dropdownRef}>
      {/* Search Box */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by order #, product, SKU, name, address, phone, wallet, transaction..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-gray-800 rounded-lg pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:w-[640px]">
        {/* Collection Filter */}
        <div className="w-full sm:w-1/4 relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'collection' ? null : 'collection')}
            className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-left flex items-center justify-between"
          >
            <span>{selectedCollections.length === 0 ? 'Collection' : `Collection (${selectedCollections.length})`}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${openDropdown === 'collection' ? 'rotate-180' : ''}`} />
          </button>
          {openDropdown === 'collection' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
              {/* Search input */}
              <div className="p-2 border-b border-gray-700">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search collections..."
                    value={collectionSearch}
                    onChange={(e) => setCollectionSearch(e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-md pl-8 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {collectionSearch && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollectionSearch('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-3.5 w-3.5 text-gray-400 hover:text-white" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Select All option */}
              <div className="max-h-60 overflow-y-auto">
                <label
                  className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedCollections.length === filteredCollections.length && filteredCollections.length > 0}
                    onChange={handleSelectAllCollections}
                    className="mr-2 rounded text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-xs sm:text-sm font-medium">
                    {selectedCollections.length === filteredCollections.length && filteredCollections.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </span>
                </label>
                
                {filteredCollections.map((collection) => (
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
                
                {filteredCollections.length === 0 && (
                  <div className="px-3 py-2 text-gray-400 text-xs">
                    No collections found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Product Filter */}
        <div className="w-full sm:w-1/4 relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'product' ? null : 'product')}
            className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-left flex items-center justify-between"
          >
            <span>{selectedProducts.length === 0 ? 'Product' : `Product (${selectedProducts.length})`}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${openDropdown === 'product' ? 'rotate-180' : ''}`} />
          </button>
          {openDropdown === 'product' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
              {/* Search input */}
              <div className="p-2 border-b border-gray-700">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-md pl-8 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {productSearch && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setProductSearch('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-3.5 w-3.5 text-gray-400 hover:text-white" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Select All option */}
              <div className="max-h-60 overflow-y-auto">
                <label
                  className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={handleSelectAllProducts}
                    className="mr-2 rounded text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-xs sm:text-sm font-medium">
                    {selectedProducts.length === filteredProducts.length && filteredProducts.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </span>
                </label>
                
                {filteredProducts.map((product) => (
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
                
                {filteredProducts.length === 0 && (
                  <div className="px-3 py-2 text-gray-400 text-xs">
                    No products found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-1/4 relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
            className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-left flex items-center justify-between"
          >
            <span>{selectedStatuses.length === 0 ? 'Status' : `Status (${selectedStatuses.length})`}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${openDropdown === 'status' ? 'rotate-180' : ''}`} />
          </button>
          {openDropdown === 'status' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
              {/* Select All option */}
              <div className="max-h-60 overflow-y-auto">
                <label
                  className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.length === statuses.length}
                    onChange={() => handleSelectAllStatuses(statuses)}
                    className="mr-2 rounded text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-xs sm:text-sm font-medium">
                    {selectedStatuses.length === statuses.length ? 'Deselect All' : 'Select All'}
                  </span>
                </label>
                
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
          )}
        </div>

        {/* Payment Method Filter */}
        <div className="w-full sm:w-1/4 relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'payment' ? null : 'payment')}
            className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-left flex items-center justify-between"
          >
            <span>{selectedPaymentMethods.length === 0 ? 'Payment' : `Payment (${selectedPaymentMethods.length})`}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${openDropdown === 'payment' ? 'rotate-180' : ''}`} />
          </button>
          {openDropdown === 'payment' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
              {/* Select All option */}
              <div className="max-h-60 overflow-y-auto">
                <label
                  className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedPaymentMethods.length === paymentMethods.length}
                    onChange={() => handleSelectAllPaymentMethods(paymentMethods)}
                    className="mr-2 rounded text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-xs sm:text-sm font-medium">
                    {selectedPaymentMethods.length === paymentMethods.length ? 'Deselect All' : 'Select All'}
                  </span>
                </label>
                
                {paymentMethods.map((method) => (
                  <label
                    key={method}
                    className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPaymentMethods.includes(method)}
                      onChange={() => handlePaymentMethodChange(method)}
                      className="mr-2 rounded text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                    />
                    <span className="text-xs sm:text-sm">
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}