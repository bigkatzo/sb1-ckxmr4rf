import { useEffect, useState, useRef } from 'react';
import { ChevronDown, X, Filter } from 'lucide-react';
import { useMerchantDashboard } from '../../contexts/MerchantDashboardContext';
import { useCategories } from '../../hooks/useCategories';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';

type FilterOption = {
  id: string;
  name: string;
  type?: string;
};

export function InlineFilterBar() {
  const { 
    selectedCollection, 
    selectedCategory, 
    setSelectedCollection, 
    setSelectedCategory,
    clearAllSelections 
  } = useMerchantDashboard();
  
  const { collections, loading: collectionsLoading } = useMerchantCollections();
  const { categories, loading: categoriesLoading } = useCategories(selectedCollection);
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<'collections' | 'categories' | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  
  // Get display values for selected items
  const selectedCollectionName = collections.find(c => c.id === selectedCollection)?.name;
  const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.name;
  
  const hasActiveFilters = selectedCollection || selectedCategory;
  
  // Close the dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveSubMenu(null);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Reset active submenu when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setActiveSubMenu(null);
    }
  }, [isOpen]);
  
  // Handle option selection
  const handleOptionSelect = (optionType: 'collection' | 'category', optionId: string) => {
    if (optionType === 'collection') {
      setSelectedCollection(optionId);
    } else {
      setSelectedCategory(optionId);
    }
    setIsOpen(false);
  };

  // Format options for rendering
  const renderOptions = (options: FilterOption[], type: 'collection' | 'category') => {
    if (options.length === 0) {
      return <div className="px-3 py-2 text-sm text-gray-400">No options available</div>;
    }
    
    return options.map((option) => (
      <button
        key={option.id}
        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${
          (type === 'collection' && selectedCollection === option.id) || 
          (type === 'category' && selectedCategory === option.id)
            ? 'bg-gray-800/50 font-medium text-primary'
            : 'text-gray-300'
        }`}
        onClick={() => handleOptionSelect(type, option.id)}
      >
        {option.name}
      </button>
    ));
  };
  
  return (
    <div className="relative" ref={filterRef}>
      {/* Filter button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm border transition-colors
          ${hasActiveFilters 
            ? 'border-primary text-primary hover:bg-primary/10' 
            : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'}
        `}
      >
        <Filter className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">
          {hasActiveFilters 
            ? `${selectedCollectionName}${selectedCategoryName ? ` • ${selectedCategoryName}` : ''}` 
            : 'Filter'}
        </span>
        {hasActiveFilters && <span className="inline sm:hidden">Active</span>}
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {/* Clear button (only shown when filters are active) */}
      {hasActiveFilters && (
        <button
          onClick={clearAllSelections}
          className="ml-1 text-gray-500 hover:text-gray-300 transition-colors"
          title="Clear all filters"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 rounded-md border border-gray-800 shadow-xl min-w-[200px] py-1 divide-y divide-gray-800">
          {/* Collection selector */}
          <div className="py-1">
            <button
              className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
              onClick={() => setActiveSubMenu(activeSubMenu === 'collections' ? null : 'collections')}
            >
              <span className="font-medium">Collection</span>
              <span className="flex items-center gap-1.5">
                {selectedCollectionName && (
                  <span className="text-primary text-xs">{selectedCollectionName}</span>
                )}
                <ChevronDown 
                  className={`h-3 w-3 transition-transform ${activeSubMenu === 'collections' ? 'rotate-180' : ''}`}
                />
              </span>
            </button>
            
            {activeSubMenu === 'collections' && (
              <div className="max-h-[200px] overflow-y-auto">
                {collectionsLoading ? (
                  <div className="px-3 py-2 animate-pulse bg-gray-800/50 mx-3 rounded"></div>
                ) : (
                  renderOptions(collections, 'collection')
                )}
              </div>
            )}
          </div>
          
          {/* Category selector - only shown when a collection is selected */}
          {selectedCollection && (
            <div className="py-1">
              <button
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                onClick={() => setActiveSubMenu(activeSubMenu === 'categories' ? null : 'categories')}
              >
                <span className="font-medium">Category</span>
                <span className="flex items-center gap-1.5">
                  {selectedCategoryName && (
                    <span className="text-primary text-xs">{selectedCategoryName}</span>
                  )}
                  <ChevronDown 
                    className={`h-3 w-3 transition-transform ${activeSubMenu === 'categories' ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>
              
              {activeSubMenu === 'categories' && (
                <div className="max-h-[200px] overflow-y-auto">
                  {categoriesLoading ? (
                    <div className="px-3 py-2 animate-pulse bg-gray-800/50 mx-3 rounded"></div>
                  ) : (
                    <button
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${
                        !selectedCategory ? 'bg-gray-800/50 font-medium text-primary' : 'text-gray-300'
                      }`}
                      onClick={() => handleOptionSelect('category', '')}
                    >
                      All Categories
                    </button>
                  )}
                  {!categoriesLoading && renderOptions(categories, 'category')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 