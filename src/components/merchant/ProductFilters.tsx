import { Search, ChevronDown, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface ProductFiltersProps {
  categories: Array<{ id: string; name: string }>;
  searchQuery: string;
  selectedCategories: string[];
  showVisible: boolean | null;
  onSaleOnly: boolean;
  onCategoryChange: (ids: string[]) => void;
  onSearchChange: (query: string) => void;
  onVisibilityChange: (showVisible: boolean | null) => void;
  onSaleChange: (onSale: boolean) => void;
}

export function ProductFilters({
  categories,
  searchQuery,
  selectedCategories,
  showVisible,
  onSaleOnly,
  onCategoryChange,
  onSearchChange,
  onVisibilityChange,
  onSaleChange
}: ProductFiltersProps) {
  const [openDropdown, setOpenDropdown] = useState<'category' | 'visibility' | 'sale' | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
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

  // Filter categories based on search term
  const filteredCategories = categories.filter(category => 
    category.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const handleCategoryChange = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoryChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      onCategoryChange([...selectedCategories, categoryId]);
    }
  };

  const handleSelectAllCategories = () => {
    if (selectedCategories.length === filteredCategories.length && filteredCategories.length > 0) {
      // Deselect all if all are already selected
      onCategoryChange([]);
    } else {
      // Select all filtered categories
      onCategoryChange(filteredCategories.map(c => c.id));
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2" ref={dropdownRef}>
      {/* Search Box */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search products by name, SKU, description..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-gray-800 rounded-lg pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:w-[550px]">
        {/* Category Filter */}
        <div className="w-full sm:w-1/3 relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
            className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary text-left flex items-center justify-between"
          >
            <span>{selectedCategories.length === 0 ? 'Category' : `Category (${selectedCategories.length})`}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${openDropdown === 'category' ? 'rotate-180' : ''}`} />
          </button>
          {openDropdown === 'category' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
              {/* Search input */}
              <div className="p-2 border-b border-gray-700">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-md pl-8 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {categorySearch && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategorySearch('');
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
                    checked={selectedCategories.length === filteredCategories.length && filteredCategories.length > 0}
                    onChange={handleSelectAllCategories}
                    className="mr-2 rounded text-primary focus:ring-primary focus:ring-offset-gray-800"
                  />
                  <span className="text-xs sm:text-sm font-medium">
                    {selectedCategories.length === filteredCategories.length && filteredCategories.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </span>
                </label>
                
                {filteredCategories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center px-3 py-2 hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => handleCategoryChange(category.id)}
                      className="mr-2 rounded text-primary focus:ring-primary focus:ring-offset-gray-800"
                    />
                    <span className="text-xs sm:text-sm">{category.name}</span>
                  </label>
                ))}
                
                {filteredCategories.length === 0 && (
                  <div className="px-3 py-2 text-gray-400 text-xs">
                    No categories found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Visibility Filter */}
        <div className="w-full sm:w-1/3 relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'visibility' ? null : 'visibility')}
            className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary text-left flex items-center justify-between"
          >
            <span>
              {showVisible === null ? 'Visibility' : showVisible ? 'Visible Only' : 'Hidden Only'}
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${openDropdown === 'visibility' ? 'rotate-180' : ''}`} />
          </button>
          {openDropdown === 'visibility' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
              <div className="max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    onVisibilityChange(null);
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-700 text-xs sm:text-sm"
                >
                  All Products
                </button>
                <button
                  onClick={() => {
                    onVisibilityChange(true);
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-700 text-xs sm:text-sm"
                >
                  Visible Only
                </button>
                <button
                  onClick={() => {
                    onVisibilityChange(false);
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-700 text-xs sm:text-sm"
                >
                  Hidden Only
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sale Status Filter */}
        <div className="w-full sm:w-1/3 relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'sale' ? null : 'sale')}
            className="w-full bg-gray-800 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary text-left flex items-center justify-between"
          >
            <span>{onSaleOnly ? 'On Sale Only' : 'Sale Status'}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${openDropdown === 'sale' ? 'rotate-180' : ''}`} />
          </button>
          {openDropdown === 'sale' && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10">
              <div className="max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    onSaleChange(false);
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-700 text-xs sm:text-sm"
                >
                  All Products
                </button>
                <button
                  onClick={() => {
                    onSaleChange(true);
                    setOpenDropdown(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-700 text-xs sm:text-sm"
                >
                  On Sale Only
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 