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
  const [isCollapsed, setIsCollapsed] = useState(false);
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

  // Check viewport size to handle mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 768);
    };
    
    handleResize(); // Set initial state
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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
  
  // Collapsed mobile view
  if (isCollapsed && !isOpen) {
    return (
      <div className="relative" ref={filterRef}>
        <button
          onClick={() => setIsOpen(true)}
          className={`
            inline-flex items-center justify-center p-2.5 rounded-md text-sm shadow-sm 
            ${hasActiveFilters 
              ? 'bg-primary text-white' 
              : 'bg-gray-800 text-gray-400 hover:text-gray-300'}
          `}
          aria-label="Filter"
          title={hasActiveFilters ? 'Active filters' : 'Filter'}
        >
          <Filter className="h-4 w-4" />
          {hasActiveFilters && (
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-white"></span>
          )}
        </button>
      </div>
    );
  }
  
  // Expanded view (desktop or expanded mobile)
  return (
    <div className="relative flex-shrink-0 w-full md:w-auto" ref={filterRef}>
      {isCollapsed && isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsOpen(false)}></div>
      )}
      
      <div className={`
        flex items-center
        ${isCollapsed && isOpen ? 'absolute top-0 left-0 z-50 w-full bg-gray-900 p-2 rounded-md shadow-lg' : ''}
      `}>
        {/* Filter button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm border transition-colors shadow-sm
            ${hasActiveFilters 
              ? 'border-primary text-primary hover:bg-primary/10' 
              : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:bg-gray-800 hover:text-gray-300'}
          `}
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="font-medium truncate max-w-[120px] md:max-w-[160px]">
              {hasActiveFilters 
                ? `${selectedCollectionName}${selectedCategoryName ? ` • ${selectedCategoryName}` : ''}` 
                : 'Global Filter'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4" />
        </button>
        
        {/* Clear button (only shown when filters are active) */}
        {hasActiveFilters && (
          <button
            onClick={clearAllSelections}
            className="ml-2 text-gray-500 hover:text-gray-300 transition-colors bg-gray-800 hover:bg-gray-700 p-1.5 rounded-md"
            title="Clear all filters"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        
        {/* Close button (mobile expanded view) */}
        {isCollapsed && isOpen && (
          <button
            onClick={() => setIsOpen(false)}
            className="ml-2 text-gray-400 hover:text-gray-300 p-1.5 bg-gray-800 hover:bg-gray-700 rounded-md"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className={`
          ${isCollapsed 
            ? 'absolute top-full left-0 right-0 mt-1 z-50' 
            : 'absolute left-0 right-0 sm:left-0 sm:right-auto top-full mt-1 z-40'}
          bg-gray-900 rounded-md border border-gray-700 shadow-xl w-full sm:min-w-[280px] py-1 divide-y divide-gray-800
        `}>
          {/* Collection selector */}
          <div className="py-1">
            <button
              className="flex items-center justify-between w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
              onClick={() => setActiveSubMenu(activeSubMenu === 'collections' ? null : 'collections')}
            >
              <span className="font-medium">Collection</span>
              <span className="flex items-center gap-2">
                {selectedCollectionName && (
                  <span className="text-primary text-sm font-medium truncate max-w-[140px]">{selectedCollectionName}</span>
                )}
                <ChevronDown 
                  className={`h-4 w-4 text-gray-400 transition-transform ${activeSubMenu === 'collections' ? 'rotate-180' : ''}`}
                />
              </span>
            </button>
            
            {activeSubMenu === 'collections' && (
              <div className="max-h-[300px] sm:max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
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
                className="flex items-center justify-between w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                onClick={() => setActiveSubMenu(activeSubMenu === 'categories' ? null : 'categories')}
              >
                <span className="font-medium">Category</span>
                <span className="flex items-center gap-2">
                  {selectedCategoryName && (
                    <span className="text-primary text-sm font-medium truncate max-w-[140px]">{selectedCategoryName}</span>
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-gray-400 transition-transform ${activeSubMenu === 'categories' ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>
              
              {activeSubMenu === 'categories' && (
                <div className="max-h-[300px] sm:max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
                  {categoriesLoading ? (
                    <div className="px-3 py-2 animate-pulse bg-gray-800/50 mx-3 rounded"></div>
                  ) : (
                    <button
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors ${
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